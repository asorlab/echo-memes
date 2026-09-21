#!/usr/bin/env node
/**
 * Importa memes em massa a partir de uma lista de links de posts do X.
 * Roda sozinho, sem navegador — baixa a mídia, sobe pro Storage do Supabase
 * e cria o card na tabela `memes`, um por link, com uma pausa educada entre
 * cada um.
 *
 * USO:
 *   1. Pegue a "service_role key" do seu projeto Supabase:
 *      supabase.com → seu projeto → Settings → API → service_role.
 *      Essa chave é secreta (dá acesso total, ignora as regras de RLS) —
 *      NUNCA comite ela nem cole em lugar nenhum além do seu .env.local.
 *   2. Cole ela no .env.local como SUPABASE_SERVICE_ROLE_KEY=...
 *   3. Crie um arquivo de texto com um link de post do X por linha
 *      (ex.: scripts/urls.txt — tem um scripts/urls-exemplo.txt de modelo).
 *   4. Rode:  node scripts/import-memes.mjs scripts/urls.txt
 *
 * O que ele NÃO faz: não escolhe quais posts importar por você, e não
 * navega em contas sozinho. Você junta os links (copiar/colar do X é
 * rápido) — isso preserva a curadoria: nada entra no acervo sem alguém
 * ter olhado o post antes.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "life-os";
const PASTA = "memes";
const PAUSA_MS = 2000;

function carregarEnvLocal() {
  const caminho = new URL("../.env.local", import.meta.url);
  if (!existsSync(caminho)) return;
  const texto = readFileSync(caminho, "utf-8");
  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const igual = l.indexOf("=");
    if (igual === -1) continue;
    const chave = l.slice(0, igual).trim();
    let valor = l.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
carregarEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DONO = process.env.MEMES_USER_EMAIL || "aivilasorr@gmail.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n" +
      "Pegue a service_role key em supabase.com -> seu projeto -> Settings -> API."
  );
  process.exit(1);
}

const arquivoLinks = process.argv[2];
if (!arquivoLinks) {
  console.error("Uso: node scripts/import-memes.mjs <arquivo-com-links.txt>");
  process.exit(1);
}
if (!existsSync(arquivoLinks)) {
  console.error(`Arquivo não encontrado: ${arquivoLinks}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function extrairId(url) {
  const m = url.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

async function buscarInfoDoPost(id) {
  const resposta = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!resposta.ok) throw new Error("post não encontrado (removido, privado, ou id inválido)");
  const dados = await resposta.json();

  const midia = dados.mediaDetails?.[0];
  if (!midia) throw new Error("esse post não tem imagem nem vídeo");

  let midiaUrl;
  let tipo;
  if (midia.type === "video" || midia.type === "animated_gif") {
    const variantes = (midia.video_info?.variants ?? []).filter(
      (v) => v.content_type === "video/mp4"
    );
    variantes.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    if (!variantes[0]) throw new Error("não achei o vídeo desse post");
    midiaUrl = variantes[0].url;
    tipo = "video";
  } else {
    midiaUrl = midia.media_url_https;
    tipo = "imagem";
  }

  return {
    texto: (dados.text ?? "").replace(/\s*https:\/\/t\.co\/\w+\s*$/, "").trim(),
    autor: dados.user?.screen_name ?? "",
    midiaUrl,
    tipo,
  };
}

async function baixarMidia(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("não consegui baixar a mídia");
  const buffer = Buffer.from(await resposta.arrayBuffer());
  const contentType = resposta.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, contentType };
}

function hashDoArquivo(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const { data: usuario, error: erroUsuario } = await supabase.auth.admin
    .listUsers({ page: 1, perPage: 200 })
    .then((r) => ({
      data: r.data?.users?.find((u) => u.email === EMAIL_DONO) ?? null,
      error: r.error,
    }));
  if (erroUsuario) throw erroUsuario;
  if (!usuario) {
    console.error(`Não achei nenhum usuário com o e-mail ${EMAIL_DONO}.`);
    process.exit(1);
  }
  const userId = usuario.id;

  const links = readFileSync(arquivoLinks, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  console.log(`Encontrei ${links.length} link(s). Começando...\n`);

  const { data: existentes } = await supabase
    .from("memes")
    .select("link_origem, midia_hash")
    .eq("user_id", userId);
  const linksJaImportados = new Set((existentes ?? []).map((m) => (m.link_origem ?? "").split("?")[0]));
  const hashesJaImportados = new Set((existentes ?? []).map((m) => m.midia_hash).filter(Boolean));

  let sucesso = 0;
  let pulados = 0;
  let falhas = 0;

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const prefixo = `[${i + 1}/${links.length}]`;
    const linkLimpo = link.split("?")[0];

    if (linksJaImportados.has(linkLimpo)) {
      console.log(`${prefixo} já importado antes, pulando: ${link}`);
      pulados++;
      continue;
    }

    const id = extrairId(link);
    if (!id) {
      console.log(`${prefixo} link inválido (sem id de post): ${link}`);
      falhas++;
      continue;
    }

    try {
      const info = await buscarInfoDoPost(id);
      const { buffer, contentType } = await baixarMidia(info.midiaUrl);
      const hash = hashDoArquivo(buffer);

      if (hashesJaImportados.has(hash)) {
        console.log(`${prefixo} vídeo/imagem já existe no acervo (outro link, mesmo arquivo), pulando: ${link}`);
        pulados++;
        continue;
      }

      const extensao = info.tipo === "video" ? "mp4" : "jpg";
      const caminho = `${userId}/${PASTA}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, buffer, { contentType });
      if (erroUpload) throw erroUpload;
      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const { error: erroInsert } = await supabase.from("memes").insert({
        user_id: userId,
        titulo: info.texto ? info.texto.slice(0, 80) : "Novo meme",
        imagem_url: publicUrlData.publicUrl,
        link_origem: link,
        explicacao: "",
        tags: info.autor ? [info.autor.toLowerCase()] : [],
        midia_hash: hash,
      });
      if (erroInsert) throw erroInsert;

      hashesJaImportados.add(hash);
      console.log(`${prefixo} importado: ${info.texto.slice(0, 60) || "(sem texto)"}`);
      sucesso++;
    } catch (erro) {
      console.log(`${prefixo} falhou (${link}): ${erro.message ?? erro}`);
      falhas++;
    }

    if (i < links.length - 1) await new Promise((r) => setTimeout(r, PAUSA_MS));
  }

  console.log(`\nPronto. ${sucesso} importado(s), ${pulados} já existiam, ${falhas} falharam.`);
}

main().catch((erro) => {
  console.error("Erro inesperado:", erro);
  process.exit(1);
});
