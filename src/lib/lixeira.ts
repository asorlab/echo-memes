import { supabaseBrowser } from "./supabase/client";
import { removerArquivo, ehCaminhoInterno } from "./storage";
import { TABELAS_COM_LIXEIRA, configDaTabela, type BucketArquivo, type ConfigTabela } from "./lixeiraConfig";

export { TABELAS_COM_LIXEIRA };

export interface ItemLixeira {
  id: string;
  tabela: string;
  rotulo: string;
  titulo: string;
  arquivoUrl: string | null;
  excluidoEm: string;
  aviso?: string;
  extras?: { caminho: string; bucket: string }[];
}

async function lerTabela(userId: string, t: ConfigTabela): Promise<ItemLixeira[]> {
  // "*": funciona antes e depois das migrations que acrescentam colunas de arquivo (0033).
  const { data, error } = await supabaseBrowser()
    .from(t.tabela)
    .select("*")
    .eq("user_id", userId)
    .not("excluido_em", "is", null)
    .order("excluido_em", { ascending: false });
  // Tabela sem excluido_em (migration 0031 ainda nao rodou) so fica de fora da lista.
  if (error) { console.error(`lixeira: erro lendo ${t.tabela}`, error.message); return []; }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    tabela: t.tabela,
    rotulo: t.rotulo,
    titulo: (r[t.campoTitulo] as string) || "(sem título)",
    arquivoUrl: t.campoArquivo ? ((r[t.campoArquivo] as string | null) ?? null) : null,
    excluidoEm: r.excluido_em as string,
    aviso: t.aviso,
    extras: (t.arquivosExtras ?? [])
      .map((x) => ({ caminho: r[x.campo] as string | null, bucket: x.bucket }))
      .filter((x): x is { caminho: string; bucket: BucketArquivo } => !!x.caminho),
  }));
}

export async function listarLixeira(userId: string): Promise<ItemLixeira[]> {
  const resultados = await Promise.all(TABELAS_COM_LIXEIRA.map((t) => lerTabela(userId, t)));
  return resultados.flat().sort((a, b) => (a.excluidoEm < b.excluidoEm ? 1 : -1));
}

export async function restaurarItem(item: Pick<ItemLixeira, "tabela" | "id">): Promise<void> {
  const { error } = await supabaseBrowser().from(item.tabela).update({ excluido_em: null }).eq("id", item.id);
  if (error) throw error;
}

// Ordem importa: remove o arquivo do Storage PRIMEIRO. So apaga o registro
// do banco se isso funcionar (ou se nunca existiu arquivo pra remover) —
// assim nunca sobra arquivo orfao nem registro apontando pra arquivo que
// nao existe mais. Se o Storage falhar, a excecao propaga e o item continua
// na lixeira intacto (quem chama decide como avisar o usuario).
export async function excluirDefinitivamente(item: Pick<ItemLixeira, "tabela" | "id" | "arquivoUrl" | "extras">): Promise<void> {
  const config = configDaTabela(item.tabela);
  if (!config) throw new Error(`Tabela fora da lixeira: ${item.tabela}`);
  if (item.arquivoUrl && ehCaminhoInterno(item.arquivoUrl)) {
    await removerArquivo(item.arquivoUrl, config.bucket);
  }
  for (const extra of item.extras ?? []) {
    if (ehCaminhoInterno(extra.caminho)) await removerArquivo(extra.caminho, extra.bucket);
  }
  const { error } = await supabaseBrowser().from(item.tabela).delete().eq("id", item.id);
  if (error) throw error;
}
