import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "playwright";

// ECHO // ASSETS — worker de sincronizacao de contas (Fontes -> Execucoes ->
// Itens). Desacoplado de onde roda: local (modo continuo, igual sempre foi)
// ou --once (processa tudo que estiver pending agora e sai — formato pronto
// pra rodar via GitHub Actions/Fly.io no dia que a hospedagem for escolhida).

// --------------------------------------------------
// ENV
// --------------------------------------------------

function carregarEnvLocal() {
  const arquivo = path.resolve(".env.local");
  if (!existsSync(arquivo)) throw new Error(".env.local não encontrado.");
  const conteudo = fs.readFileSync(arquivo, "utf8");
  for (const linha of conteudo.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const indice = limpa.indexOf("=");
    if (indice === -1) continue;
    const chave = limpa.slice(0, indice).trim();
    let valor = limpa.slice(indice + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
  }
}
carregarEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definido.");
if (!SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY não está definido.");

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "life-os";
const MODO_UNICO = process.argv.includes("--once");
const TIMEOUT_PROCESSING_MS = 15 * 60 * 1000; // 15min sem update = worker morto

// --------------------------------------------------
// CLASSIFICAÇÃO DE ERRO — traduz a mensagem tecnica do yt-dlp numa
// categoria estavel, sem fingir mais precisao do que o proprio yt-dlp da.
// --------------------------------------------------

function classificarErro(mensagem) {
  const m = (mensagem || "").toLowerCase();
  if (m.includes("private") && m.includes("embedding")) return "privado_ou_embed_desabilitado";
  if (m.includes("login required") || m.includes("cookies") || m.includes("sign in")) return "autenticacao_necessaria";
  if (m.includes("429") || m.includes("too many requests") || m.includes("rate limit")) return "bloqueio_anti_bot";
  if (m.includes("403") || m.includes("forbidden") || m.includes("captcha")) return "bloqueio_anti_bot";
  if (m.includes("404") || m.includes("not found") || m.includes("account does not exist")) return "nao_encontrado";
  if (m.includes("unsupported url") || m.includes("no video formats") || m.includes("unable to extract")) return "erro_extrator";
  return "desconhecido";
}

// --------------------------------------------------
// YT-DLP
// --------------------------------------------------

function executarYtDlp(argumentos) {
  return new Promise((resolve, reject) => {
    const processo = spawn("yt-dlp", argumentos, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    processo.stdout.on("data", (d) => { stdout += d.toString(); });
    processo.stderr.on("data", (d) => { stderr += d.toString(); });
    processo.on("error", reject);
    processo.on("close", (codigo) => {
      if (codigo !== 0) {
        reject(new Error(`yt-dlp terminou com código ${codigo}\n${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function listarVideosPerfilTiktok(url) {
  console.log(`🔎 Lendo perfil completo: ${url}`);
  const saida = await executarYtDlp(["--flat-playlist", "--print", "%(id)s|||%(webpage_url)s|||%(uploader)s", url]);
  const linhas = saida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const vistos = new Set();
  const itens = [];
  for (const linha of linhas) {
    const [id, webpageUrl, uploader] = linha.split("|||");
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    itens.push({ externalId: id, url: webpageUrl || url, autor: uploader || null });
  }
  return itens;
}

// Hashtag e um feed sem fim (algoritmico, nao cronologico garantido) — por
// isso sempre limitado a --playlist-end N, nunca lido por inteiro. Dedup
// contra import_items existentes acontece igual ao perfil, no chamador.
async function listarVideosHashtagTiktok(url, limite) {
  console.log(`🔎 Lendo hashtag (top ${limite}): ${url}`);
  const saida = await executarYtDlp(["--flat-playlist", "--playlist-end", String(limite), "--print", "%(id)s|||%(webpage_url)s|||%(uploader)s", url]);
  const linhas = saida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const vistos = new Set();
  const itens = [];
  for (const linha of linhas) {
    const [id, webpageUrl, uploader] = linha.split("|||");
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    itens.push({ externalId: id, url: webpageUrl || url, autor: uploader || null });
  }
  return itens;
}

// --------------------------------------------------
// FALLBACK DE DISCOVERY DE PERFIL — o extrator "tiktok:user" do yt-dlp as
// vezes nao consegue extrair o secUid de um perfil (mensagem "private or
// embedding disabled" / "Unable to extract secondary user ID"), mesmo em
// contas publicas — confirmado direto no JSON que a propria pagina do
// TikTok embute (privateAccount:false, isEmbedBanned:false). Uma requisicao
// HTTP simples (curl/fetch) e bloqueada pelo WAF anti-robo do TikTok; so um
// navegador de verdade passa. Por isso o Playwright entra so aqui, como
// fallback pontual — abre, le o secUid, fecha imediatamente. Nunca baixa
// video (isso continua 100% no yt-dlp).
const PADRAO_FALHA_DISCOVERY_PERFIL = /private or embedding disabled|unable to extract secondary user id/i;

async function obterSecUidViaPlaywright(profileUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    // O TikTok as vezes serve uma pagina de desafio anti-robo ("Please
    // wait...") antes da pagina real — ela resolve sozinha em alguns
    // segundos (confirmado empiricamente). Espera o elemento certo
    // aparecer em vez de checar imediatamente, sem atrasar o caso comum
    // (quando a pagina real ja vem direto).
    await page.waitForSelector("#__UNIVERSAL_DATA_FOR_REHYDRATION__", { timeout: 15000 }).catch(() => {});
    return await page.evaluate(() => {
      const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
      if (!el) return null;
      try {
        const json = JSON.parse(el.textContent);
        const user = json.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user;
        if (!user) return null;
        return { secUid: user.secUid ?? null, privateAccount: !!user.privateAccount, isEmbedBanned: !!user.isEmbedBanned };
      } catch {
        return null;
      }
    });
  } finally {
    await browser.close();
  }
}

function erroClassificado(mensagem, categoria) {
  const erro = new Error(mensagem);
  erro.categoria = categoria;
  return erro;
}

// Troca a URL de cada item (que sai errada — com o secUid no lugar do
// @usuario — quando a descoberta usou "tiktokuser:<secUid>") pela URL real
// do perfil, pra download/exibicao ficarem corretos.
function normalizarUrlsPerfil(itens, username) {
  return itens.map((item) => ({ ...item, url: `https://www.tiktok.com/@${username}/video/${item.externalId}` }));
}

async function discoverPerfilTiktok(fonte) {
  // 1. secUid em cache — tenta direto, sem abrir navegador.
  if (fonte.sec_uid) {
    try {
      const itens = await listarVideosPerfilTiktok(`tiktokuser:${fonte.sec_uid}`);
      console.log("   [discovery: cached_secuid]");
      return normalizarUrlsPerfil(itens, fonte.username);
    } catch {
      console.log("   ⚠ secUid em cache parou de funcionar — invalidando e tentando de novo.");
      await supabase.from("import_sources").update({ sec_uid: null }).eq("id", fonte.id);
    }
  }

  // 2. metodo direto (mais leve, tentativa padrao).
  try {
    const itens = await listarVideosPerfilTiktok(fonte.profile_url);
    console.log("   [discovery: direct]");
    return itens;
  } catch (erroDireto) {
    const mensagem = erroDireto instanceof Error ? erroDireto.message : String(erroDireto);
    if (!PADRAO_FALHA_DISCOVERY_PERFIL.test(mensagem)) throw erroDireto; // erro de outro tipo, nao mascarar

    console.log("   ⚠ Discovery direto falhou (padrao conhecido) — acionando fallback Playwright...");
    let dados;
    try {
      dados = await obterSecUidViaPlaywright(fonte.profile_url);
    } catch (erroPlaywright) {
      throw erroClassificado(`Nao foi possivel abrir o perfil pra obter o secUid: ${erroPlaywright.message}`, "secuid_resolution_failed");
    }
    if (!dados) throw erroClassificado("Playwright abriu a pagina mas nao encontrou os dados do perfil (formato da pagina pode ter mudado).", "secuid_resolution_failed");
    if (dados.privateAccount) throw erroClassificado("Conta confirmada como privada pelo proprio TikTok (privateAccount=true).", "private_account");
    if (!dados.secUid) throw erroClassificado("secUid nao encontrado nos dados do perfil.", "secuid_resolution_failed");

    let itens;
    try {
      itens = await listarVideosPerfilTiktok(`tiktokuser:${dados.secUid}`);
    } catch (erroFinal) {
      throw erroClassificado(`secUid obtido, mas a descoberta ainda falhou: ${erroFinal.message}`, "profile_discovery_failed");
    }
    await supabase.from("import_sources").update({ sec_uid: dados.secUid }).eq("id", fonte.id);
    console.log("   [discovery: playwright_secuid_fallback] — secUid cacheado pra proxima sincronizacao");
    return normalizarUrlsPerfil(itens, fonte.username);
  }
}

// --------------------------------------------------
// DISCOVERY — abstracao por plataforma+tipo, pra poder trocar so o
// mecanismo de uma combinacao (ex.: tiktok+hashtag) sem tocar no resto do
// worker. Perfil usa yt-dlp + fallback Playwright (ver acima). Hashtag
// ainda nao tem provider configurado — falha rapido e claro em vez de
// tentar algo fragil.
// --------------------------------------------------

// hashtag: null = sem provider plugado ainda (yt-dlp nao consegue mais
// descobrir /tag/... — ver scripts/import-worker.mjs:listarVideosHashtagTiktok,
// mantida pronta pra reusar assim que um provider real for escolhido).
const DISCOVERY_PROVIDERS = {
  tiktok: {
    profile: (fonte) => discoverPerfilTiktok(fonte),
    hashtag: null,
  },
};

async function discoverSource(fonte) {
  const tipo = fonte.source_type || "profile";
  const providers = DISCOVERY_PROVIDERS[fonte.platform];
  const provider = providers?.[tipo];
  if (!provider) {
    throw new Error(`Discovery automatico de "${tipo}" ainda nao tem um provider configurado nessa plataforma. Perfil continua funcionando normalmente.`);
  }
  return provider(fonte);
}

async function obterInfoVideo(url) {
  const saida = await executarYtDlp(["--dump-single-json", "--no-playlist", url]);
  return JSON.parse(saida);
}

async function baixarVideo(url, externalId) {
  const base = path.join(os.tmpdir(), `echo-${externalId}-${Date.now()}`);
  const arquivoFinal = `${base}.mp4`;
  await executarYtDlp(["--no-playlist", "-f", "best", "--recode-video", "mp4", "-o", arquivoFinal, url]);
  if (!existsSync(arquivoFinal)) throw new Error(`O yt-dlp terminou, mas o arquivo final não foi encontrado: ${arquivoFinal}`);
  return arquivoFinal;
}

// --------------------------------------------------
// STORAGE / MEMES
// --------------------------------------------------

async function memeExistente(userId, plataforma, externalId) {
  const { data, error } = await supabase.from("memes").select("id").eq("user_id", userId).eq("plataforma", plataforma).eq("external_id", externalId).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Camada 2 de dedup: mesmo conteudo baixado de fontes/URLs diferentes
// (ex.: o mesmo video em @conta1 e @conta2) tem o MESMO hash de arquivo,
// mesmo com external_id/URL diferentes — Camada 1 (external_id) nao pega
// isso, so essa camada.
async function calcularHashArquivo(caminho) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(caminho);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function memeExistentePorHash(userId, hash) {
  const { data, error } = await supabase.from("memes").select("id").eq("user_id", userId).eq("arquivo_hash", hash).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function enviarParaStorage(userId, plataforma, externalId, arquivo) {
  const bytes = await readFile(arquivo);
  const extensao = path.extname(arquivo).replace(".", "") || "mp4";
  const caminho = `${userId}/memes/${plataforma}/${externalId}.${extensao}`;
  const contentType = extensao === "webm" ? "video/webm" : "video/mp4";
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType, upsert: false });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (!msg.includes("already exists") && !msg.includes("duplicate")) throw error;
  }
  return caminho; // caminho puro — bucket privado, sem getPublicUrl
}

function dataPublicacao(info) {
  if (info.timestamp) return new Date(info.timestamp * 1000).toISOString();
  if (info.upload_date && /^\d{8}$/.test(info.upload_date)) {
    const ano = info.upload_date.slice(0, 4), mes = info.upload_date.slice(4, 6), dia = info.upload_date.slice(6, 8);
    return new Date(`${ano}-${mes}-${dia}T00:00:00Z`).toISOString();
  }
  return null;
}

async function criarMeme({ userId, plataforma, info, urlOriginal, caminho, externalId, hash }) {
  const criador = info.uploader_id || info.uploader || info.channel || null;
  const titulo = info.title || info.description?.slice(0, 120) || "Vídeo importado";
  const tags = criador ? [String(criador).replace(/^@/, "").toLowerCase()] : [];
  const { data, error } = await supabase.from("memes").insert({
    user_id: userId, titulo: String(titulo).slice(0, 200), imagem_url: caminho, link_origem: urlOriginal,
    explicacao: "", tags, plataforma, criador, categoria: "geral", publicado_em: dataPublicacao(info), external_id: externalId, arquivo_hash: hash,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

// --------------------------------------------------
// EXECUÇÕES (import_runs) / ITENS (import_items)
// --------------------------------------------------

async function recuperarExecucoesTravadas() {
  const limite = new Date(Date.now() - TIMEOUT_PROCESSING_MS).toISOString();
  const { data, error } = await supabase.from("import_runs").select("id").in("status", ["discovering", "processing"]).lt("updated_at", limite);
  if (error) throw error;
  for (const run of data ?? []) {
    console.log(`⚠ Execução ${run.id} travada — marcando como falha.`);
    await supabase.from("import_runs").update({
      status: "failed", error_message: "Worker interrompido antes de terminar (timeout de segurança).",
      finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", run.id);
  }
}

async function proximaExecucaoPendente() {
  const { data, error } = await supabase.from("import_runs").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// UPDATE atomico condicionado a status='pending' — se 0 linhas mudarem,
// outra execucao (outro worker) ja reivindicou esse job.
async function reivindicarExecucao(runId) {
  const { data, error } = await supabase.from("import_runs")
    .update({ status: "discovering", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId).eq("status", "pending").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

async function atualizarExecucao(runId, patch) {
  const { error } = await supabase.from("import_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw error;
}

async function execucaoFoiCancelada(runId) {
  const { data } = await supabase.from("import_runs").select("status").eq("id", runId).maybeSingle();
  return data?.status === "cancelled";
}

// --------------------------------------------------
// PROCESSAMENTO DE UMA EXECUÇÃO
// --------------------------------------------------

async function processarExecucao(run) {
  console.log(`\n==== EXECUÇÃO ${run.id} (fonte ${run.source_id}) ====`);

  const { data: fonte, error: erroFonte } = await supabase.from("import_sources").select("*").eq("id", run.source_id).single();
  if (erroFonte) throw erroFonte;

  const tipoFonte = fonte.source_type || "profile";
  console.log(`Fonte: ${tipoFonte === "hashtag" ? "#" : "@"}${fonte.username} (${fonte.platform}, ${tipoFonte})`);

  try {
    // ---- descoberta ----
    const descobertos = await discoverSource(fonte);
    console.log(`✓ ${descobertos.length} vídeo(s) encontrados.`);

    const { data: existentes, error: erroExistentes } = await supabase.from("import_items").select("external_id").eq("source_id", fonte.id);
    if (erroExistentes) throw erroExistentes;
    const idsExistentes = new Set((existentes ?? []).map((r) => r.external_id));
    const novos = descobertos.filter((d) => !idsExistentes.has(d.externalId));

    // Limite de quantidade (digitado na tela) — corta ANTES de criar
    // import_items, nunca depois do download. descobertos/novos ja vem do
    // mais recente pro mais antigo, entao os N primeiros = os N mais
    // recentes ainda nao conhecidos. O resto simplesmente nao vira item
    // nenhum agora — fica disponivel pra "Importar mais antigos" depois,
    // sem aparecer como fila pendente.
    const limite = run.limite_selecionado;
    const selecionados = limite != null ? novos.slice(0, limite) : novos;

    console.log(`✓ ${novos.length} novo(s) (${descobertos.length - novos.length} já conhecido(s)) — selecionados pra essa execução: ${selecionados.length}${limite != null ? ` (limite pedido: ${limite})` : ""}.`);

    if (selecionados.length > 0) {
      const linhas = selecionados.map((n) => ({
        source_id: fonte.id, user_id: fonte.user_id, platform: fonte.platform, external_id: n.externalId,
        original_url: n.url, author: n.autor, status: "pending", discovered_in_run_id: run.id,
      }));
      const { error: erroInsert } = await supabase.from("import_items").upsert(linhas, { onConflict: "user_id,platform,external_id", ignoreDuplicates: true });
      if (erroInsert) throw erroInsert;
    }

    await atualizarExecucao(run.id, { status: "processing", total_found: descobertos.length, total_new: novos.length, total_selected: selecionados.length });

    // ---- processamento (todos os pending da fonte, nao so os novos —
    // assim retry de item falho entra no mesmo fluxo) ----
    const { data: pendentes, error: erroPendentes } = await supabase.from("import_items").select("*").eq("source_id", fonte.id).eq("status", "pending").order("created_at", { ascending: true });
    if (erroPendentes) throw erroPendentes;

    let baixados = 0, ignorados = 0, falhados = 0;

    for (let i = 0; i < (pendentes ?? []).length; i++) {
      const item = pendentes[i];

      if (await execucaoFoiCancelada(run.id)) {
        console.log("\n⊘ EXECUÇÃO CANCELADA PELO ECHO");
        await atualizarExecucao(run.id, { finished_at: new Date().toISOString() });
        return;
      }

      console.log(`\n[${i + 1}/${pendentes.length}] ${item.external_id}`);

      const memeIdExistente = await memeExistente(fonte.user_id, fonte.platform, item.external_id);
      if (memeIdExistente) {
        console.log("   ↷ já existe como meme. Ignorando.");
        await supabase.from("import_items").update({ status: "skipped", meme_id: memeIdExistente, processed_in_run_id: run.id, updated_at: new Date().toISOString() }).eq("id", item.id);
        ignorados++;
        await atualizarExecucao(run.id, { total_skipped: ignorados, total_downloaded: baixados, total_failed: falhados });
        continue;
      }

      let arquivo = null;
      try {
        const info = await obterInfoVideo(item.original_url);
        arquivo = await baixarVideo(item.original_url, item.external_id);
        const hash = await calcularHashArquivo(arquivo);

        // Camada 2: conteudo identico ja existe (outra fonte/URL/external_id
        // diferente, mesmo arquivo) — nao faz outro upload nem outro meme,
        // so vincula esse item ao meme que ja existe e descarta o temporario.
        const memeIdIgual = await memeExistentePorHash(fonte.user_id, hash);
        if (memeIdIgual) {
          await supabase.from("import_items").update({
            status: "skipped", meme_id: memeIdIgual, processed_in_run_id: run.id, attempts: item.attempts + 1,
            author: info.uploader_id || info.uploader || item.author, caption: info.description?.slice(0, 500) ?? item.caption,
            published_at: dataPublicacao(info), updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          console.log("   ↷ arquivo idêntico a um meme existente (hash). Vinculado, sem duplicar.");
          ignorados++;
          await atualizarExecucao(run.id, { total_skipped: ignorados, total_downloaded: baixados, total_failed: falhados });
          continue;
        }

        const caminho = await enviarParaStorage(fonte.user_id, fonte.platform, item.external_id, arquivo);
        const memeId = await criarMeme({ userId: fonte.user_id, plataforma: fonte.platform, info, urlOriginal: item.original_url, caminho, externalId: item.external_id, hash });

        await supabase.from("import_items").update({
          status: "completed", meme_id: memeId, processed_in_run_id: run.id, attempts: item.attempts + 1,
          author: info.uploader_id || info.uploader || item.author, caption: info.description?.slice(0, 500) ?? item.caption,
          published_at: dataPublicacao(info), updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        console.log("   ✓ Importado");
        baixados++;
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        console.error(`   ✗ Falhou: ${mensagem.split("\n")[0]}`);
        await supabase.from("import_items").update({
          status: "failed", error_message: mensagem.slice(0, 5000), error_category: classificarErro(mensagem),
          processed_in_run_id: run.id, attempts: item.attempts + 1, updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        falhados++;
      } finally {
        if (arquivo && existsSync(arquivo)) await unlink(arquivo).catch(() => {});
      }

      await atualizarExecucao(run.id, { total_skipped: ignorados, total_downloaded: baixados, total_failed: falhados });
    }

    if (await execucaoFoiCancelada(run.id)) {
      console.log("\n⊘ EXECUÇÃO CANCELADA PELO ECHO");
      await atualizarExecucao(run.id, { finished_at: new Date().toISOString() });
      return;
    }

    await atualizarExecucao(run.id, { status: "completed", finished_at: new Date().toISOString() });

    const { count } = await supabase.from("import_items").select("id", { count: "exact", head: true }).eq("source_id", fonte.id).eq("status", "completed");
    await supabase.from("import_sources").update({ last_synced_at: new Date().toISOString(), total_imported: count ?? 0, updated_at: new Date().toISOString() }).eq("id", fonte.id);

    console.log(`\n==== CONCLUÍDO: ${baixados} novo(s), ${ignorados} já existia(m), ${falhados} falharam ====`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const cancelada = await execucaoFoiCancelada(run.id).catch(() => false);
    if (cancelada) { console.log("\n⊘ Cancelada."); return; }
    await atualizarExecucao(run.id, {
      status: "failed", error_message: mensagem.slice(0, 5000), error_category: erro?.categoria ?? null,
      finished_at: new Date().toISOString(),
    });
    throw erro;
  }
}

// --------------------------------------------------
// LOOP PRINCIPAL
// --------------------------------------------------

const INTERVALO_FILA_MS = 5000;
function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

let encerrando = false;
process.on("SIGINT", () => { console.log("\n\nECHO // Encerrando worker..."); encerrando = true; });

async function processarTudoPendente() {
  await recuperarExecucoesTravadas();
  let processouAlgo = false;
  while (!encerrando) {
    const proxima = await proximaExecucaoPendente();
    if (!proxima) break;
    const reivindicada = await reivindicarExecucao(proxima.id);
    if (!reivindicada) continue; // outro worker pegou primeiro
    processouAlgo = true;
    try {
      await processarExecucao(reivindicada);
    } catch (erro) {
      console.error("\n✗ EXECUÇÃO FALHOU:", erro instanceof Error ? erro.message : erro);
    }
  }
  return processouAlgo;
}

async function main() {
  console.log("\n====================================");
  console.log(`ECHO // WORKER DE CONTAS ${MODO_UNICO ? "(modo --once)" : "(modo contínuo)"}`);
  console.log("====================================\n");

  if (MODO_UNICO) {
    await processarTudoPendente();
    console.log("\n✓ Nada mais pendente — encerrando (--once).");
    return;
  }

  console.log("Monitorando novas sincronizações. Pressione Ctrl+C para encerrar.\n");
  while (!encerrando) {
    try {
      const processou = await processarTudoPendente();
      if (!processou && !encerrando) {
        process.stdout.write("\rECHO // Aguardando novas sincronizações... ");
        await esperar(INTERVALO_FILA_MS);
      }
    } catch (erro) {
      console.error("\n✗ Erro no loop principal:", erro instanceof Error ? erro.message : erro);
      await esperar(INTERVALO_FILA_MS);
    }
  }
  console.log("✓ Worker encerrado.");
}

main().catch((erro) => {
  console.error("\n✗ WORKER FALHOU");
  console.error(erro);
  process.exitCode = 1;
});
