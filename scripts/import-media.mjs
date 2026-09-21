#!/usr/bin/env node

import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";

import { spawn } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";


// =====================================================
// CONFIG
// =====================================================

const DOWNLOAD_DIR = path.resolve("scripts/.downloads");
const BUCKET = "life-os";

mkdirSync(DOWNLOAD_DIR, { recursive: true });


// =====================================================
// .ENV.LOCAL
// =====================================================

function carregarEnv() {
  const arquivo = path.resolve(".env.local");

  if (!existsSync(arquivo)) {
    throw new Error(".env.local não encontrado.");
  }

  const texto = readFileSync(arquivo, "utf8");

  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.trim();

    if (!l || l.startsWith("#")) continue;

    const pos = l.indexOf("=");

    if (pos === -1) continue;

    const chave = l.slice(0, pos).trim();

    let valor = l.slice(pos + 1).trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

carregarEnv();


const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const USER_EMAIL =
  process.env.MEMES_USER_EMAIL;


if (!SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL não encontrada."
  );
}

if (!SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY não encontrada."
  );
}

if (!USER_EMAIL) {
  throw new Error(
    "MEMES_USER_EMAIL não encontrado."
  );
}


const supabase = createClient(
  SUPABASE_URL,
  SERVICE_KEY
);


// =====================================================
// YT-DLP
// =====================================================

function ytDlp(args) {
  return new Promise((resolve, reject) => {
    const processo = spawn(
      "yt-dlp",
      args,
      {
        shell: false,
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    processo.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    processo.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    processo.on("error", reject);

    processo.on("close", (codigo) => {
      if (codigo === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            stderr ||
            `yt-dlp terminou com código ${codigo}`
          )
        );
      }
    });
  });
}


// =====================================================
// METADADOS
// =====================================================

async function obterInfo(url) {
  const json = await ytDlp([
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    url,
  ]);

  return JSON.parse(json);
}


function plataforma(info) {
  const origem = String(
    info.extractor_key ||
    info.extractor ||
    ""
  ).toLowerCase();

  if (origem.includes("tiktok"))
    return "tiktok";

  if (origem.includes("twitter"))
    return "x";

  if (origem.includes("instagram"))
    return "instagram";

  if (origem.includes("youtube"))
    return "youtube";

  return origem || "outro";
}


// =====================================================
// LOCALIZAR USUÁRIO DO ECHO
// =====================================================

async function buscarUsuario() {
  const { data, error } =
    await supabase.auth.admin.listUsers();

  if (error) throw error;

  const usuario = data.users.find(
    (u) =>
      u.email?.toLowerCase() ===
      USER_EMAIL.toLowerCase()
  );

  if (!usuario) {
    throw new Error(
      `Não encontrei ${USER_EMAIL} no Supabase Auth.`
    );
  }

  return usuario;
}


// =====================================================
// VERIFICAR DUPLICIDADE
// =====================================================

async function existe(plataformaNome, id) {
  const { data, error } =
    await supabase
      .from("memes")
      .select("id")
      .eq("plataforma", plataformaNome)
      .eq("external_id", id)
      .limit(1);

  if (error) throw error;

  return Boolean(data?.length);
}


// =====================================================
// DOWNLOAD
// =====================================================

async function baixar(url, id) {
  console.log("↓ Baixando vídeo...");

  const template =
    path.join(
      DOWNLOAD_DIR,
      `${id}.%(ext)s`
    );

  await ytDlp([
    "--no-playlist",

    "-f",
    "bv*+ba/b",

    "--merge-output-format",
    "mp4",

    "-o",
    template,

    url,
  ]);


  const arquivos =
    readdirSync(DOWNLOAD_DIR);


  const nome =
    arquivos.find(
      (arquivo) =>
        arquivo.startsWith(`${id}.`)
    );


  if (!nome) {
    throw new Error(
      "Download terminou, mas não encontrei o arquivo."
    );
  }


  return path.join(
    DOWNLOAD_DIR,
    nome
  );
}


// =====================================================
// SUPABASE STORAGE
// =====================================================

async function enviarStorage(
  userId,
  plataformaNome,
  id,
  arquivo
) {
  console.log("↑ Enviando ao Supabase...");

  const extensao =
    path.extname(arquivo) || ".mp4";


  const storagePath =
    `${userId}/memes/` +
    `${plataformaNome}/` +
    `${id}${extensao}`;


  const bytes =
    readFileSync(arquivo);


  const { error } =
    await supabase.storage
      .from(BUCKET)
      .upload(
        storagePath,
        bytes,
        {
          contentType: "video/mp4",
          upsert: false,
        }
      );


  if (error) throw error;


  const { data } =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);


  return data.publicUrl;
}


// =====================================================
// CRIAR CARD
// =====================================================

async function criarCard({
  userId,
  info,
  plataformaNome,
  id,
  mediaUrl,
  originalUrl,
}) {
  console.log("＋ Criando card no ECHO...");


  const criador =
    info.uploader ||
    info.creator ||
    info.channel ||
    info.uploader_id ||
    null;


  const titulo =
    String(
      info.description ||
      info.title ||
      "Referência TikTok"
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 250);


  let publicadoEm = null;

  if (info.timestamp) {
    publicadoEm =
      new Date(
        info.timestamp * 1000
      ).toISOString();
  }


  const registro = {
    user_id: userId,

    titulo,

    imagem_url: mediaUrl,

    link_origem: originalUrl,

    explicacao: "",

    tags: criador
      ? [
          String(criador)
            .replace(/^@/, "")
            .toLowerCase(),
        ]
      : [],

    plataforma: plataformaNome,

    criador,

    categoria: "geral",

    publicado_em: publicadoEm,

    external_id: id,
  };


  const { error } =
    await supabase
      .from("memes")
      .insert(registro);


  if (error) throw error;
}


// =====================================================
// IMPORTAÇÃO
// =====================================================

async function importar(url) {
  console.log("\nECHO // IMPORTADOR");
  console.log("==============================");

  console.log("\n1. Analisando vídeo...");

  const info =
    await obterInfo(url);


  const id =
    String(info.id || "");


  if (!id) {
    throw new Error(
      "O vídeo não possui um ID identificável."
    );
  }


  const plataformaNome =
    plataforma(info);


  const criador =
    info.uploader ||
    info.creator ||
    info.channel ||
    "desconhecido";


  console.log("✓ Encontrado");
  console.log("  Plataforma:", plataformaNome);
  console.log("  Criador:", criador);
  console.log("  ID:", id);


  console.log(
    "\n2. Localizando sua conta..."
  );

  const usuario =
    await buscarUsuario();

  console.log(
    "✓",
    usuario.email
  );


  console.log(
    "\n3. Verificando duplicidade..."
  );


  if (
    await existe(
      plataformaNome,
      id
    )
  ) {
    console.log(
      "↳ Esse vídeo já está no ECHO."
    );

    return;
  }


  console.log("✓ É novo");


  console.log(
    "\n4. Fazendo download..."
  );

  const arquivo =
    await baixar(
      url,
      id
    );


  try {
    console.log(
      "\n5. Salvando mídia..."
    );


    const mediaUrl =
      await enviarStorage(
        usuario.id,
        plataformaNome,
        id,
        arquivo
      );


    console.log(
      "\n6. Registrando no ECHO..."
    );


    await criarCard({
      userId: usuario.id,
      info,
      plataformaNome,
      id,
      mediaUrl,
      originalUrl:
        info.webpage_url || url,
    });


    console.log(
      "\n✓✓✓ IMPORTAÇÃO CONCLUÍDA ✓✓✓"
    );

  } finally {
    if (existsSync(arquivo)) {
      unlinkSync(arquivo);
    }
  }
}


// =====================================================
// START
// =====================================================

const url = process.argv[2];

if (!url) {
  console.log(`
Uso:

node .\\scripts\\import-media.mjs "URL"
`);

  process.exit(1);
}


try {
  await importar(url);
} catch (erro) {
  console.error("\n✗ IMPORTAÇÃO FALHOU");
  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exit(1);
}