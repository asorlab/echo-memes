// Regras puras do worker de ingestao (scripts/echo-worker.mjs).
// Teste: scripts/testes/ingest-logica.test.mjs

export const EXTENSOES_VIDEO = [".mp4", ".mov", ".mkv", ".webm", ".m4v"];
export const LIMITE_PROXY_BYTES = 450 * 1024 * 1024; // bucket producao-raw aceita 500 MB; folga para o cabecalho
export const IDADE_MINIMA_MS = 20_000; // arquivo parado ha 20 s (OBS terminou de gravar)

export function ehVideo(nome) {
  const n = String(nome).toLowerCase();
  return !n.startsWith(".") && EXTENSOES_VIDEO.some((e) => n.endsWith(e));
}

// Arquivo pronto para entrar: mesmo tamanho na varredura anterior e sem mudar ha 20 s.
export function arquivoEstavel(anterior, atual, agoraMs) {
  if (!anterior || atual.tamanho === 0) return false;
  return anterior.tamanho === atual.tamanho && anterior.mtimeMs === atual.mtimeMs && agoraMs - atual.mtimeMs >= IDADE_MINIMA_MS;
}

function dataLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Arquivo numa subpasta ("Live 14-10/parte1.mp4") vira a sessao daquela subpasta;
// solto na raiz, entra na sessao do dia ("Gravação 15/10/2026").
export function sessaoDoArquivo(caminhoRelativo, mtimeMs) {
  const partes = String(caminhoRelativo).split(/[\\/]/).filter(Boolean);
  const data = dataLocal(mtimeMs);
  if (partes.length > 1) {
    const pasta = partes[0];
    return { chave: `pasta:${pasta}`, nome: pasta, data, pasta };
  }
  const [a, m, d] = data.split("-");
  return { chave: `dia:${data}`, nome: `Gravação ${d}/${m}/${a}`, data, pasta: null };
}

// Proxy que cabe no limite: taxa total = limite / duracao, com teto de 1500 kbps.
// Abaixo de 600 kbps de video, cai para 360p; acima, 540p (ou 720p com folga).
export function planoProxy(duracaoSeg, limiteBytes = LIMITE_PROXY_BYTES) {
  const dur = Math.max(1, Number(duracaoSeg) || 1);
  const audioKbps = 64;
  const totalKbps = Math.floor((limiteBytes * 8) / 1000 / dur * 0.92);
  const videoKbps = Math.max(120, Math.min(1500, totalKbps - audioKbps));
  const altura = videoKbps >= 1100 ? 720 : videoKbps >= 600 ? 540 : 360;
  return { altura, videoKbps, audioKbps };
}

// Filtro de escala que respeita vertical (9:16) e horizontal: o lado menor vira a altura alvo.
export function filtroEscala(largura, altura, alvo) {
  if (!largura || !altura) return `scale=-2:${alvo}`;
  const menor = Math.min(largura, altura);
  if (menor <= alvo) return "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  return largura >= altura ? `scale=-2:${alvo}` : `scale=${alvo}:-2`;
}

function fracao(txt) {
  const [a, b] = String(txt ?? "").split("/").map(Number);
  if (!a || !b) return null;
  return Math.round((a / b) * 100) / 100;
}

// Saida do ffprobe (-print_format json -show_format -show_streams) para o que guardamos.
export function lerFfprobe(json) {
  const streams = Array.isArray(json?.streams) ? json.streams : [];
  const v = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  const a = streams.find((s) => s.codec_type === "audio");
  const duracao = Number(json?.format?.duration ?? v?.duration ?? 0) || null;
  let largura = v?.width ?? null, altura = v?.height ?? null;
  const rot = Math.abs(Number(v?.tags?.rotate ?? v?.side_data_list?.find?.((x) => x.rotation != null)?.rotation ?? 0));
  if (rot === 90 || rot === 270) [largura, altura] = [altura, largura];
  return {
    duracao_seg: duracao ? Math.round(duracao * 100) / 100 : null,
    largura, altura,
    fps: fracao(v?.avg_frame_rate) ?? fracao(v?.r_frame_rate),
    codec_video: v?.codec_name ?? null,
    codec_audio: a?.codec_name ?? null,
    tem_audio: !!a,
    canais_audio: a?.channels ?? null,
    bitrate_kbps: json?.format?.bit_rate ? Math.round(Number(json.format.bit_rate) / 1000) : null,
    orientacao: largura && altura ? (altura > largura ? "vertical" : "horizontal") : null,
  };
}

// Linha do "-progress pipe:1" do ffmpeg para porcentagem (null quando a linha nao e de tempo).
export function progressoDaLinha(linha, duracaoSeg) {
  const m = /^out_time_(?:ms|us)=(\d+)/.exec(String(linha).trim());
  if (!m || !duracaoSeg) return null;
  const seg = Number(m[1]) / 1_000_000;
  return Math.max(0, Math.min(99, Math.floor((seg / duracaoSeg) * 100)));
}

// Mensagem curta e segura para a tela (sem caminho completo nem stack trace).
export function mensagemSegura(erro) {
  const txt = String(erro?.message ?? erro ?? "erro desconhecido").split("\n").map((l) => l.trim()).filter(Boolean);
  const util = txt.reverse().find((l) => !/^(at |ffmpeg version|built with|configuration:|lib\w+\s)/.test(l)) ?? "erro desconhecido";
  return util.replace(/[A-Z]:\\[^\n]*?(?=: |$)/gi, "(arquivo)").slice(0, 300);
}
