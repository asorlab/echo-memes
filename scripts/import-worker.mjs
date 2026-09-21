import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// --------------------------------------------------
// ENV
// --------------------------------------------------

function carregarEnvLocal() {
  const arquivo = path.resolve(".env.local");

  if (!existsSync(arquivo)) {
    throw new Error(".env.local não encontrado.");
  }

  const conteudo = fs.readFileSync(arquivo, "utf8");

  for (const linha of conteudo.split(/\r?\n/)) {
    const limpa = linha.trim();

    if (!limpa || limpa.startsWith("#")) continue;

    const indice = limpa.indexOf("=");

    if (indice === -1) continue;

    const chave = limpa.slice(0, indice).trim();
    let valor = limpa.slice(indice + 1).trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    // Para este worker, o .env.local é a fonte de verdade.
    process.env[chave] = valor;
  }
}

carregarEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definido.");
}

if (!SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_SECRET_KEY não está definido.");
}

if (!SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
  throw new Error(
    "SUPABASE_SECRET_KEY não parece ser uma Secret key válida (sb_secret_...)."
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const BUCKET = "life-os";

// --------------------------------------------------
// YT-DLP
// --------------------------------------------------

function executarYtDlp(argumentos) {
  return new Promise((resolve, reject) => {
    const processo = spawn("yt-dlp", argumentos, {
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    processo.stdout.on("data", (dados) => {
      stdout += dados.toString();
    });

    processo.stderr.on("data", (dados) => {
      stderr += dados.toString();
    });

    processo.on("error", (erro) => {
      reject(erro);
    });

    processo.on("close", (codigo) => {
      if (codigo !== 0) {
        reject(
          new Error(
            `yt-dlp terminou com código ${codigo}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve(stdout);
    });
  });
}

// --------------------------------------------------
// TIKTOK / PERFIL
// --------------------------------------------------

async function listarVideosPerfil(url) {
  console.log(`🔎 Lendo perfil completo: ${url}`);

  const saida = await executarYtDlp([
    "--flat-playlist",
    "--print",
    "%(webpage_url)s",
    url,
  ]);

  const urls = saida
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith("http"));

  return [...new Set(urls)];
}

async function obterInfoVideo(url) {
  console.log("   🔎 Analisando vídeo...");

  const saida = await executarYtDlp([
    "--dump-single-json",
    "--no-playlist",
    url,
  ]);

  return JSON.parse(saida);
}

// --------------------------------------------------
// DOWNLOAD
// --------------------------------------------------

async function baixarVideo(url, externalId) {
  const base = path.join(
    os.tmpdir(),
    `echo-${externalId}-${Date.now()}`
  );

  const arquivoFinal = `${base}.mp4`;

  console.log("   ↓ Baixando vídeo...");

  await executarYtDlp([
    "--no-playlist",
    "-f",
    "best",
    "--recode-video",
    "mp4",
    "-o",
    arquivoFinal,
    url,
  ]);

  if (!existsSync(arquivoFinal)) {
    throw new Error(
      `O yt-dlp terminou, mas o arquivo final não foi encontrado: ${arquivoFinal}`
    );
  }

  console.log("   ✓ Download concluído");

  return arquivoFinal;
}

// --------------------------------------------------
// SUPABASE / MEMES
// --------------------------------------------------

async function memeJaExiste(
  userId,
  plataforma,
  externalId
) {
  const { data, error } = await supabase
    .from("memes")
    .select("id")
    .eq("user_id", userId)
    .eq("plataforma", plataforma)
    .eq("external_id", externalId)
    .limit(1);

  if (error) throw error;

  return Boolean(data?.length);
}

async function enviarParaStorage(
  userId,
  plataforma,
  externalId,
  arquivo
) {
  const bytes = await readFile(arquivo);

  const extensao =
    path.extname(arquivo).replace(".", "") || "mp4";

  const caminho =
    `${userId}/memes/${plataforma}/${externalId}.${extensao}`;

  const contentType =
    extensao === "webm"
      ? "video/webm"
      : "video/mp4";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, bytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    const mensagem =
      String(error.message || "").toLowerCase();

    // Se o arquivo já estiver no Storage,
    // reutilizamos o mesmo caminho.
    if (
      !mensagem.includes("already exists") &&
      !mensagem.includes("duplicate")
    ) {
      throw error;
    }
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(caminho);

  if (!data?.publicUrl) {
    throw new Error(
      `Não foi possível gerar a URL pública de ${caminho}.`
    );
  }

  return data.publicUrl;
}

function dataPublicacao(info) {
  if (info.timestamp) {
    return new Date(
      info.timestamp * 1000
    ).toISOString();
  }

  if (
    info.upload_date &&
    /^\d{8}$/.test(info.upload_date)
  ) {
    const ano = info.upload_date.slice(0, 4);
    const mes = info.upload_date.slice(4, 6);
    const dia = info.upload_date.slice(6, 8);

    return new Date(
      `${ano}-${mes}-${dia}T00:00:00Z`
    ).toISOString();
  }

  return null;
}

async function criarMeme({
  tarefa,
  info,
  urlOriginal,
  publicUrl,
  externalId,
}) {
  const criador =
    info.uploader_id ||
    info.uploader ||
    info.channel ||
    null;

  const titulo =
    info.title ||
    info.description?.slice(0, 120) ||
    "Vídeo importado";

  const tags = [];

  if (criador) {
    tags.push(
      String(criador)
        .replace(/^@/, "")
        .toLowerCase()
    );
  }

  const { error } = await supabase
    .from("memes")
    .insert({
      user_id: tarefa.user_id,
      titulo: String(titulo).slice(0, 200),
      imagem_url: publicUrl,
      link_origem: urlOriginal,
      explicacao: "",
      tags,
      plataforma: "tiktok",
      criador,
      categoria: tarefa.categoria || "geral",
      publicado_em: dataPublicacao(info),
      external_id: externalId,
    });

  if (error) throw error;
}

// --------------------------------------------------
// FILA
// --------------------------------------------------

async function atualizarTarefa(id, patch) {
  const { error } = await supabase
    .from("meme_import_queue")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

async function buscarProximaTarefa() {
  const { data, error } = await supabase
    .from("meme_import_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// --------------------------------------------------
// IMPORTAÇÃO DE UM VÍDEO
// --------------------------------------------------

async function importarVideo(
  tarefa,
  url,
  numero,
  total
) {
  console.log(`\n[${numero}/${total}] ${url}`);

  const info = await obterInfoVideo(url);

  const externalId =
    String(info.id || "").trim();

  if (!externalId) {
    throw new Error(
      `Vídeo sem ID: ${url}`
    );
  }

  const existe = await memeJaExiste(
    tarefa.user_id,
    "tiktok",
    externalId
  );

  if (existe) {
    console.log(
      `   ↷ ${externalId} já existe. Pulando.`
    );

    return "existente";
  }

  console.log(`   ID: ${externalId}`);

  console.log(
    `   Criador: ${
      info.uploader_id ||
      info.uploader ||
      "desconhecido"
    }`
  );

  let arquivo = null;

  try {
    arquivo = await baixarVideo(
      url,
      externalId
    );

    console.log(
      "   ↑ Enviando ao Supabase..."
    );

    const publicUrl =
      await enviarParaStorage(
        tarefa.user_id,
        "tiktok",
        externalId,
        arquivo
      );

    console.log(
      "   ✓ Arquivo enviado ao Storage"
    );

    console.log(
      "   ＋ Criando card no ECHO..."
    );

    await criarMeme({
      tarefa,
      info,
      urlOriginal: url,
      publicUrl,
      externalId,
    });

    console.log(
      "   ✓ Card criado no ECHO"
    );

    return "importado";
  } finally {
    if (
      arquivo &&
      existsSync(arquivo)
    ) {
      await unlink(arquivo).catch(
        () => {}
      );
    }
  }
}

// --------------------------------------------------
// PROCESSAMENTO DA TAREFA
// --------------------------------------------------

async function processarTarefa(tarefa) {
  console.log(
    "\n===================================="
  );
  console.log(
    "ECHO // IMPORT WORKER"
  );
  console.log(
    "===================================="
  );

  console.log(
    `Tarefa: ${tarefa.id}`
  );

  console.log(
    `Fonte: ${tarefa.source_url}`
  );

  console.log(
    `Tipo: ${tarefa.source_type}`
  );

  console.log(
    `Categoria: ${
      tarefa.categoria || "geral"
    }`
  );

  await atualizarTarefa(
    tarefa.id,
    {
      status: "processing",
      error_message: null,
      processed_items: 0,
    }
  );

  try {
    let urls = [];

    if (
      tarefa.source_type === "profile"
    ) {
      urls =
        await listarVideosPerfil(
          tarefa.source_url
        );
    } else {
      urls = [
        tarefa.source_url,
      ];
    }

    if (urls.length === 0) {
      throw new Error(
        "Nenhum vídeo foi encontrado nessa fonte."
      );
    }

    console.log(
      `\n✓ ${urls.length} vídeo(s) encontrado(s).`
    );

    await atualizarTarefa(
      tarefa.id,
      {
        total_items: urls.length,
      }
    );

    let processados = 0;

    for (
      let i = 0;
      i < urls.length;
      i++
    ) {
      await importarVideo(
        tarefa,
        urls[i],
        i + 1,
        urls.length
      );

      processados++;

      await atualizarTarefa(
        tarefa.id,
        {
          processed_items:
            processados,
        }
      );
    }

    await atualizarTarefa(
      tarefa.id,
      {
        status: "completed",
        processed_items:
          processados,
        error_message: null,
      }
    );

    console.log(
      "\n===================================="
    );

    console.log(
      "✓ IMPORTAÇÃO CONCLUÍDA"
    );

    console.log(
      `${processados}/${urls.length} processados`
    );

    console.log(
      "===================================="
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(erro);

    await atualizarTarefa(
      tarefa.id,
      {
        status: "failed",
        error_message:
          mensagem.slice(
            0,
            5000
          ),
      }
    ).catch(() => {});

    throw erro;
  }
}

// --------------------------------------------------
// WORKER CONTÍNUO
// --------------------------------------------------

const INTERVALO_FILA_MS = 5000;

function esperar(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

let encerrando = false;

process.on("SIGINT", () => {
  console.log(
    "\n\nECHO // Encerrando worker..."
  );
  encerrando = true;
});

async function main() {
  console.log(
    "\n===================================="
  );
  console.log(
    "ECHO // WORKER ATIVO"
  );
  console.log(
    "===================================="
  );
  console.log(
    "Monitorando novas importações."
  );
  console.log(
    "Pressione Ctrl+C para encerrar.\n"
  );

  while (!encerrando) {
    try {
      const tarefa =
        await buscarProximaTarefa();

      if (!tarefa) {
        process.stdout.write(
          "\rECHO // Aguardando novas importações... "
        );

        await esperar(
          INTERVALO_FILA_MS
        );
        continue;
      }

      // Limpa a linha "aguardando"
      process.stdout.write(
        "\r" + " ".repeat(60) + "\r"
      );

      try {
        await processarTarefa(
          tarefa
        );
      } catch (erro) {
        console.error(
          "\n✗ IMPORTAÇÃO FALHOU"
        );

        console.error(
          erro instanceof Error
            ? erro.message
            : erro
        );

        console.log(
          "\nECHO // O worker continuará ativo."
        );
      }

      if (!encerrando) {
        console.log(
          "\nECHO // Procurando próxima tarefa..."
        );
      }
    } catch (erro) {
      console.error(
        "\n✗ Erro ao consultar a fila:"
      );

      console.error(
        erro instanceof Error
          ? erro.message
          : erro
      );

      console.log(
        `Tentando novamente em ${
          INTERVALO_FILA_MS / 1000
        } segundos...`
      );

      await esperar(
        INTERVALO_FILA_MS
      );
    }
  }

  console.log(
    "✓ Worker encerrado."
  );
}

main().catch((erro) => {
  console.error(
    "\n✗ WORKER FALHOU"
  );
  console.error(erro);
  process.exitCode = 1;
});