import { supabaseBrowser } from "./supabase/client";

const BUCKET = "life-os";

// Allowlist client-side — primeira barreira, resposta imediata pro usuario.
// A que realmente conta e a configurada no bucket do Storage (allowedMimeTypes/
// fileSizeLimit), que o navegador nao pode contornar.
const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/webm", "audio/mp4", "audio/ogg", "audio/aac", "audio/x-m4a",
];
// 50MB e o teto real do bucket no plano atual do Supabase (confirmado
// tentando configurar mais alto — o projeto recusou); o cliente valida o
// mesmo numero antes de tentar subir, so pra dar erro imediato em vez de
// mandar o arquivo inteiro e falhar no fim. Video mais longo de edit pode
// passar disso — se acontecer com frequencia, vale olhar o plano do Supabase.
const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024; // 50MB

// Sobe o arquivo e devolve o CAMINHO dentro do bucket (nao mais uma URL
// publica) — o bucket e privado, entao toda leitura passa por URL assinada
// (urlAssinada/urlsAssinadas) gerada na hora de exibir/baixar.
export async function enviarArquivo(pasta: string, userId: string, arquivo: File) {
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new Error(`Tipo de arquivo nao permitido: ${arquivo.type || "desconhecido"}`);
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error(`Arquivo maior que o limite (${Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024))}MB)`);
  }

  const supabase = supabaseBrowser();

  // Rate limit de upload — mesma tabela/funcao usada pelas rotas de API do
  // echo-os-app (banco compartilhado), chamada direto do navegador.
  const { data: permitido, error: erroLimite } = await supabase.rpc("checar_rate_limit", {
    p_chave: `upload:${userId}`,
    p_limite: 40,
    p_janela_seg: 3600,
  });
  if (!erroLimite && permitido === false) {
    throw new Error("Muitos uploads em pouco tempo — tenta de novo em instantes");
  }

  const extensao = arquivo.name.split(".").pop();
  const caminho = `${userId}/${pasta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
  if (error) throw error;
  return caminho;
}

export async function urlAssinada(caminho: string, expiraEmSeg = 3600): Promise<string | null> {
  const { data } = await supabaseBrowser().storage.from(BUCKET).createSignedUrl(caminho, expiraEmSeg);
  return data?.signedUrl ?? null;
}

// Linhas gravadas antes da migracao pro storage privado ainda guardam a URL
// publica completa (getPublicUrl antigo) — so depois do backfill elas viram
// caminho puro. Tratar os dois formatos evita quebrar exibicao no meio da
// transicao (deploy do codigo novo e o backfill do banco nao precisam ser
// no mesmo instante).
export function ehCaminhoInterno(valor: string): boolean {
  return !/^https?:\/\//i.test(valor);
}

// Devolve a URL pronta pra usar num src: valor antigo (URL completa) como
// esta, caminho novo resolvido pelo mapa (undefined se ainda nao resolvido).
export function resolverUrl(valor: string | null | undefined, urls: Record<string, string>): string | undefined {
  if (!valor) return undefined;
  return ehCaminhoInterno(valor) ? urls[valor] : valor;
}

// Resolve varios caminhos de uma vez (uma chamada so pra carregar a grade
// inteira). Devolve um mapa caminho -> URL assinada; URLs antigas (publicas)
// e valores vazios/nulos sao ignorados.
export async function urlsAssinadas(caminhos: (string | null | undefined)[], expiraEmSeg = 3600): Promise<Record<string, string>> {
  const unicos = Array.from(new Set(caminhos.filter((c): c is string => !!c && ehCaminhoInterno(c))));
  if (unicos.length === 0) return {};
  const { data } = await supabaseBrowser().storage.from(BUCKET).createSignedUrls(unicos, expiraEmSeg);
  const mapa: Record<string, string> = {};
  (data ?? []).forEach((d, i) => { if (d?.signedUrl) mapa[unicos[i]] = d.signedUrl; });
  return mapa;
}

// Lanca erro se a remocao falhar — quem chama (ex.: exclusao definitiva da
// lixeira) precisa saber que o arquivo NAO foi removido, pra nao apagar o
// registro do banco e fingir que a exclusao terminou.
export async function removerArquivo(caminho: string) {
  const { error } = await supabaseBrowser().storage.from(BUCKET).remove([caminho]);
  if (error) throw error;
}
