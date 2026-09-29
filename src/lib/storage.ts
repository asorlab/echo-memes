import { supabaseBrowser } from "./supabase/client";

const BUCKET = "life-os";

// Sobe o arquivo e devolve o CAMINHO dentro do bucket (nao mais uma URL
// publica) — o bucket e privado, entao toda leitura passa por URL assinada
// (urlAssinada/urlsAssinadas) gerada na hora de exibir/baixar.
export async function enviarArquivo(pasta: string, userId: string, arquivo: File) {
  const supabase = supabaseBrowser();
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

export async function removerArquivo(caminho: string) {
  await supabaseBrowser().storage.from(BUCKET).remove([caminho]);
}
