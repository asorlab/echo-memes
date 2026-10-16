// ECHO // Creator OS: worker local de producao (Fase 2).
//
// Roda no PC (onde ficam os originais). Faz duas coisas:
//   1) Pasta vigiada: video novo em ECHO_PASTA_BRUTOS (padrao: Videos\ECHO Brutos) vira
//      bruto numa sessao (subpasta = sessao; solto na raiz = sessao do dia) e ganha um job "ingest".
//   2) Fila: pega jobs "ingest" (producao_jobs, via reivindicar_job) e gera metadados (ffprobe),
//      capa e tira de miniaturas (vao para a nuvem) e proxy leve (fica no PC e, se couber, vai para a nuvem).
//
// O original nunca sai do PC. Nada e apagado do disco.
//   npm run worker:producao          continuo (varre a cada 15 s)
//   npm run worker:producao -- --once   processa o que houver e sai
//
// .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, MEMES_USER_EMAIL (ou ECHO_WORKER_USER_ID),
// opcional ECHO_PASTA_BRUTOS.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ehVideo, arquivoEstavel, sessaoDoArquivo, planoProxy, filtroEscala, lerFfprobe, progressoDaLinha, mensagemSegura, LIMITE_PROXY_BYTES,
  CODIFICADORES, codificadorPorId, planoDisco, tamanhoEstimadoProxy,
} from "./worker/ingest-logica.mjs";

const VERSAO = "fase2-2";
const MODO_UNICO = process.argv.includes("--once");
const INTERVALO_MS = 15_000;

// ---------- ambiente ----------
function carregarEnv() {
  const arquivo = path.resolve(".env.local");
  if (!fs.existsSync(arquivo)) throw new Error(".env.local não encontrado (rode na pasta do echo-memes).");
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i === -1) continue;
    process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
carregarEnv();
const { NEXT_PUBLIC_SUPABASE_URL: URL_SB, SUPABASE_SECRET_KEY: CHAVE } = process.env;
if (!URL_SB || !CHAVE) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local.");
const sb = createClient(URL_SB, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });

const PASTA = path.resolve(process.env.ECHO_PASTA_BRUTOS || path.join(os.homedir(), "Videos", "ECHO Brutos"));
const PASTA_PROXY = path.join(PASTA, ".echo-proxy");
const WORKER_ID = `${os.hostname()}-producao`;

function log(...a) { console.log(new Date().toISOString(), ...a); }

async function descobrirUsuario() {
  if (process.env.ECHO_WORKER_USER_ID) return process.env.ECHO_WORKER_USER_ID;
  const email = (process.env.MEMES_USER_EMAIL || "").toLowerCase();
  if (!email) throw new Error("Defina MEMES_USER_EMAIL ou ECHO_WORKER_USER_ID no .env.local.");
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Usuário ${email} não encontrado.`);
}

// ---------- processos ----------
function rodar(cmd, args, { aoLinha } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true, shell: false });
    let saida = "", erro = "", resto = "";
    p.stdout.on("data", (d) => {
      const t = d.toString();
      saida += t.length < 2_000_000 ? t : "";
      if (aoLinha) { resto += t; const linhas = resto.split(/\r?\n/); resto = linhas.pop() ?? ""; linhas.forEach(aoLinha); }
    });
    p.stderr.on("data", (d) => { erro = (erro + d.toString()).slice(-8000); });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve(saida) : reject(new Error(`${cmd} saiu com código ${c}\n${erro}`))));
  });
}

// Testa cada codificador com 3 quadros pretos: o primeiro que funciona de verdade e o usado.
let codificador = null;
async function detectarCodificador() {
  if (codificador) return codificador;
  for (const c of CODIFICADORES) {
    if (c.id === "libx264") break;
    try {
      await rodar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=0.2", "-frames:v", "3", ...c.args, "-f", "null", "-"]);
      codificador = c;
      log(`codificador de vídeo: ${c.rotulo} (${c.id})`);
      return c;
    } catch { /* placa ausente ou driver sem suporte: tenta o proximo */ }
  }
  codificador = codificadorPorId("libx264");
  log("codificador de vídeo: processador (libx264)");
  return codificador;
}

function espacoLivre(dir) {
  try { const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch { return Number.MAX_SAFE_INTEGER; }
}

function hashArquivo(caminho) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    fs.createReadStream(caminho, { highWaterMark: 4 * 1024 * 1024 }).on("data", (c) => h.update(c)).on("error", reject).on("end", () => resolve(h.digest("hex")));
  });
}

// ---------- fila ----------
async function registrarLog(job, nivel, mensagem) {
  await sb.from("producao_job_logs").insert({ job_id: job.id, user_id: job.user_id, nivel, mensagem: mensagem.slice(0, 1000) });
}

async function sinalDeVida(userId, detalhe = {}) {
  await sb.from("producao_worker_status").upsert({ worker_id: WORKER_ID, user_id: userId, visto_em: new Date().toISOString(), pasta: PASTA, versao: VERSAO, detalhe });
}

// ---------- pasta vigiada ----------
const vistos = new Map(); // caminho -> { tamanho, mtimeMs }

async function listarVideos(raiz) {
  const saida = [];
  async function andar(dir, nivel) {
    let itens = [];
    try { itens = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      if (it.name.startsWith(".")) continue;
      const cheio = path.join(dir, it.name);
      if (it.isDirectory() && nivel === 0) await andar(cheio, 1);
      else if (it.isFile() && ehVideo(it.name)) saida.push(cheio);
    }
  }
  await andar(raiz, 0);
  return saida;
}

const sessoesCache = new Map();
async function sessaoPara(userId, info) {
  if (sessoesCache.has(info.chave)) return sessoesCache.get(info.chave);
  let q = sb.from("producao_sessoes").select("id").eq("user_id", userId).is("excluido_em", null).limit(1);
  q = info.pasta ? q.eq("pasta_local", info.pasta) : q.is("pasta_local", null).eq("data", info.data).eq("nome", info.nome);
  const { data: existente } = await q.maybeSingle();
  let id = existente?.id;
  if (!id) {
    const { data, error } = await sb.from("producao_sessoes").insert({ user_id: userId, nome: info.nome, data: info.data, pasta_local: info.pasta }).select("id").single();
    if (error) throw error;
    id = data.id;
    log(`sessão nova: ${info.nome}`);
  }
  sessoesCache.set(info.chave, id);
  return id;
}

async function varrerPasta(userId) {
  await fsp.mkdir(PASTA, { recursive: true });
  const agora = Date.now();
  for (const caminho of await listarVideos(PASTA)) {
    let st;
    try { st = await fsp.stat(caminho); } catch { continue; }
    const atual = { tamanho: st.size, mtimeMs: st.mtimeMs };
    const anterior = vistos.get(caminho);
    vistos.set(caminho, atual);
    if (anterior?.registrado) { vistos.set(caminho, { ...atual, registrado: true }); continue; }
    if (!arquivoEstavel(anterior, atual, agora)) continue;

    // Ja registrado (mesmo caminho e tamanho)? Nao faz nada.
    const { data: jaTem } = await sb.from("producao_brutos").select("id").eq("user_id", userId).eq("caminho_local", caminho).eq("tamanho_bytes", st.size).limit(1);
    if (jaTem?.length) { vistos.set(caminho, { ...atual, registrado: true }); continue; }

    log(`arquivo novo: ${path.basename(caminho)} (${Math.round(st.size / 1e6)} MB), calculando hash...`);
    const hash = await hashArquivo(caminho);
    const { data: duplicado } = await sb.from("producao_brutos").select("id, nome, caminho_local").eq("user_id", userId).eq("hash_arquivo", hash).is("excluido_em", null).limit(1);
    if (duplicado?.length) {
      // Mesmo video em outro lugar: so atualiza o caminho (o arquivo mudou de pasta), sem bruto novo.
      await sb.from("producao_brutos").update({ caminho_local: caminho }).eq("id", duplicado[0].id);
      log(`duplicata de "${duplicado[0].nome}": caminho atualizado, nada novo criado`);
      vistos.set(caminho, { ...atual, registrado: true });
      continue;
    }
    const sessaoId = await sessaoPara(userId, sessaoDoArquivo(path.relative(PASTA, caminho), st.mtimeMs));
    const { data: bruto, error } = await sb.from("producao_brutos").insert({
      user_id: userId, nome: path.basename(caminho), origem: "pasta", tamanho_bytes: st.size, status: "processando",
      caminho_local: caminho, hash_arquivo: hash, sessao_id: sessaoId,
    }).select("id").single();
    if (error) { log("erro ao registrar bruto:", error.message); continue; }
    await sb.from("producao_jobs").insert({ user_id: userId, tipo: "ingest", status: "queued", referencia_tabela: "producao_brutos", referencia_id: bruto.id, payload: { bruto_id: bruto.id } });
    vistos.set(caminho, { ...atual, registrado: true });
    log(`bruto registrado e na fila: ${path.basename(caminho)}`);
  }
}

// ---------- job ingest ----------
async function subir(bucket, caminho, arquivo, tipo) {
  const corpo = await fsp.readFile(arquivo);
  const { error } = await sb.storage.from(bucket).upload(caminho, corpo, { contentType: tipo, upsert: true });
  if (error) throw new Error(`upload ${bucket}: ${error.message}`);
  return caminho;
}

async function ingest(job) {
  const brutoId = job.payload?.bruto_id ?? job.referencia_id;
  const { data: bruto, error } = await sb.from("producao_brutos").select("*").eq("id", brutoId).maybeSingle();
  if (error || !bruto) throw new Error("Bruto não encontrado (pode ter sido excluído).");
  if (!bruto.caminho_local || !fs.existsSync(bruto.caminho_local)) throw new Error("O arquivo original não está mais na pasta do PC.");
  const origem = bruto.caminho_local;
  const uid = bruto.user_id;
  const hb = (p) => sb.rpc("heartbeat_job", { p_id: job.id, p_progresso: p });

  // 1) metadados
  const sonda = await rodar("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", origem]);
  const meta = lerFfprobe(JSON.parse(sonda));
  if (!meta.duracao_seg) throw new Error("Não consegui ler a duração do vídeo (arquivo incompleto ou corrompido?).");
  await sb.from("producao_brutos").update({ duracao_seg: meta.duracao_seg, metadados: meta }).eq("id", brutoId);
  await registrarLog(job, "info", `Metadados: ${meta.largura}x${meta.altura}, ${meta.fps ?? "?"} fps, ${Math.round(meta.duracao_seg / 60)} min, ${meta.tem_audio ? "com" : "sem"} áudio.`);
  await hb(5);

  // 2) capa e tira de miniaturas (vao para a nuvem, bucket life-os)
  await fsp.mkdir(PASTA_PROXY, { recursive: true });
  const capa = path.join(PASTA_PROXY, `${brutoId}-capa.jpg`);
  const tira = path.join(PASTA_PROXY, `${brutoId}-tira.jpg`);
  const meio = Math.max(0, meta.duracao_seg * 0.1);
  await rodar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(meio), "-i", origem, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", capa]);
  const quadros = 20;
  await rodar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", origem, "-vf", `fps=${quadros}/${meta.duracao_seg},scale=192:-2,tile=${quadros}x1`, "-frames:v", "1", "-q:v", "5", tira]);
  const miniatura_url = await subir("life-os", `${uid}/producao/${brutoId}/capa.jpg`, capa, "image/jpeg");
  const sprite_url = await subir("life-os", `${uid}/producao/${brutoId}/tira.jpg`, tira, "image/jpeg");
  await sb.from("producao_brutos").update({ miniatura_url, sprite_url }).eq("id", brutoId);
  await hb(10);

  // 3) proxy leve (vai para a nuvem se couber no limite do bucket; no PC so fica se o disco tiver folga)
  const plano = planoProxy(meta.duracao_seg);
  const disco = planoDisco(espacoLivre(PASTA_PROXY), tamanhoEstimadoProxy(meta.duracao_seg, plano));
  if (!disco.podeGerar) {
    await fsp.rm(capa, { force: true }); await fsp.rm(tira, { force: true });
    await sb.from("producao_brutos").update({ status: bruto.status === "em_projeto" ? "em_projeto" : "novo" }).eq("id", brutoId);
    await registrarLog(job, "aviso", `${disco.motivo} Metadados e miniaturas foram feitos; o proxy fica para quando houver espaço (Preparar de novo).`);
    return { proxy: "sem_espaco" };
  }
  const proxy = path.join(PASTA_PROXY, `${brutoId}.mp4`);
  const base = ["-hide_banner", "-y", "-i", origem, "-vf", filtroEscala(meta.largura, meta.altura, plano.altura), "-r", String(Math.min(30, Math.round(meta.fps || 30)))];
  const taxa = ["-b:v", `${plano.videoKbps}k`, "-maxrate", `${Math.round(plano.videoKbps * 1.4)}k`, "-bufsize", `${plano.videoKbps * 2}k`];
  const audio = meta.tem_audio ? ["-c:a", "aac", "-b:a", `${plano.audioKbps}k`, "-ac", "1"] : ["-an"];
  const fim = ["-movflags", "+faststart", "-progress", "pipe:1", "-nostats", proxy];
  let ultimo = 0;
  const aoLinha = (linha) => {
    const p = progressoDaLinha(linha, meta.duracao_seg);
    if (p !== null && Date.now() - ultimo > 5000) { ultimo = Date.now(); hb(10 + Math.floor(p * 0.85)); }
  };
  let enc = await detectarCodificador();
  try {
    await rodar("ffmpeg", [...base, ...enc.args, ...taxa, ...audio, ...fim], { aoLinha });
  } catch (e) {
    if (enc.id === "libx264") throw e;
    await registrarLog(job, "aviso", `A ${enc.rotulo} recusou este vídeo; refazendo pelo processador (mais lento).`);
    enc = codificadorPorId("libx264");
    await rodar("ffmpeg", [...base, ...enc.args, ...taxa, ...audio, ...fim], { aoLinha });
  }
  const tamanhoProxy = (await fsp.stat(proxy)).size;
  let proxy_url = null;
  if (tamanhoProxy <= LIMITE_PROXY_BYTES) {
    proxy_url = await subir("producao-raw", `${uid}/proxy/${brutoId}.mp4`, proxy, "video/mp4");
  } else {
    await registrarLog(job, "aviso", `Proxy ficou com ${Math.round(tamanhoProxy / 1e6)} MB, acima do limite da nuvem; ficou só no PC.`);
  }
  // Disco apertado: com o proxy ja na nuvem, a copia local sai para nao lotar o PC.
  let ficouNoPc = true;
  if (proxy_url && disco.apagarLocal) { await fsp.rm(proxy, { force: true }); ficouNoPc = false; }
  await fsp.rm(capa, { force: true }); await fsp.rm(tira, { force: true });
  const statusFinal = bruto.status === "em_projeto" ? "em_projeto" : "novo";
  await sb.from("producao_brutos").update({ proxy_url, status: statusFinal, erro_mensagem: null }).eq("id", brutoId);
  await registrarLog(job, "info", `Proxy ${plano.altura}p pela ${enc.rotulo}, ${Math.round(tamanhoProxy / 1e6)} MB${proxy_url ? ", enviado para a nuvem" : ""}${ficouNoPc ? "" : " (cópia do PC apagada: disco com pouco espaço)"}.`);
  return { proxy_mb: Math.round(tamanhoProxy / 1e6), codificador: enc.id, altura: plano.altura, proxy_no_pc: ficouNoPc };
}

const EXECUTORES = { ingest };

async function processarFila() {
  for (;;) {
    const { data, error } = await sb.rpc("reivindicar_job", { p_tipos: Object.keys(EXECUTORES), p_worker: WORKER_ID });
    if (error) { log("fila indisponível:", error.message); return; }
    const job = Array.isArray(data) ? data[0] : data;
    if (!job) return;
    log(`job ${job.tipo} ${job.id} (tentativa ${job.tentativas})`);
    try {
      const resultado = await EXECUTORES[job.tipo](job);
      await sb.rpc("concluir_job", { p_id: job.id, p_resultado: resultado ?? null });
      log(`job concluído ${job.id}`);
    } catch (e) {
      const msg = mensagemSegura(e);
      log(`job falhou ${job.id}: ${msg}`);
      await registrarLog(job, "erro", msg).catch(() => {});
      await sb.rpc("falhar_job", { p_id: job.id, p_erro: msg });
      const brutoId = job.payload?.bruto_id ?? job.referencia_id;
      if (brutoId && job.tentativas >= (job.max_tentativas ?? 3)) await sb.from("producao_brutos").update({ status: "erro", erro_mensagem: msg }).eq("id", brutoId);
    }
  }
}

// ---------- laco ----------
async function principal() {
  const userId = await descobrirUsuario();
  log(`ECHO worker de produção ${VERSAO} | pasta: ${PASTA} | ${MODO_UNICO ? "uma rodada" : "contínuo"}`);
  for (;;) {
    try {
      const c = await detectarCodificador();
      await sinalDeVida(userId, { codificador: c.id, codificador_rotulo: c.rotulo, gpu: c.id !== "libx264", disco_livre_gb: Math.round(espacoLivre(PASTA) / 1024 ** 3 * 10) / 10 });
      await varrerPasta(userId);
      if (MODO_UNICO) { await new Promise((r) => setTimeout(r, 21_000)); await varrerPasta(userId); } // arquivo precisa de 2 varreduras
      await processarFila();
    } catch (e) {
      log("erro na rodada:", mensagemSegura(e));
    }
    if (MODO_UNICO) break;
    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

principal().catch((e) => { console.error(mensagemSegura(e)); process.exit(1); });
