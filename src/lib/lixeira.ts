import { supabaseBrowser } from "./supabase/client";
import { removerArquivo, ehCaminhoInterno } from "./storage";

// Config de cada tabela de asset que participa da lixeira. O nome da coluna
// de arquivo varia (memes usa imagem_url, o resto usa arquivo_url).
interface ConfigTabela {
  tabela: string;
  campoArquivo: "imagem_url" | "arquivo_url";
  rotulo: string;
}

export const TABELAS_COM_LIXEIRA: ConfigTabela[] = [
  { tabela: "memes", campoArquivo: "imagem_url", rotulo: "Meme" },
  { tabela: "audios", campoArquivo: "arquivo_url", rotulo: "Áudio" },
  { tabela: "visuais", campoArquivo: "arquivo_url", rotulo: "Visual" },
  { tabela: "templates", campoArquivo: "arquivo_url", rotulo: "Template" },
  { tabela: "fontes", campoArquivo: "arquivo_url", rotulo: "Fonte" },
  { tabela: "brand_assets", campoArquivo: "arquivo_url", rotulo: "Brand asset" },
  { tabela: "paletas", campoArquivo: "arquivo_url", rotulo: "Paleta" },
  { tabela: "inspiracoes", campoArquivo: "arquivo_url", rotulo: "Inspiração" },
  { tabela: "edicoes_referencia", campoArquivo: "arquivo_url", rotulo: "Edit" },
];

export interface ItemLixeira {
  id: string;
  tabela: string;
  campoArquivo: "imagem_url" | "arquivo_url";
  rotulo: string;
  titulo: string;
  arquivoUrl: string | null;
  excluidoEm: string;
}

export async function listarLixeira(userId: string): Promise<ItemLixeira[]> {
  const supabase = supabaseBrowser();
  const resultados = await Promise.all(
    TABELAS_COM_LIXEIRA.map(async (t) => {
      const { data, error } = await supabase
        .from(t.tabela)
        .select(`id, titulo, ${t.campoArquivo}, excluido_em`)
        .eq("user_id", userId)
        .not("excluido_em", "is", null)
        .order("excluido_em", { ascending: false });
      if (error) { console.error(`lixeira: erro lendo ${t.tabela}`, error.message); return []; }
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        tabela: t.tabela,
        campoArquivo: t.campoArquivo,
        rotulo: t.rotulo,
        titulo: (r.titulo as string) || "(sem título)",
        arquivoUrl: (r[t.campoArquivo] as string | null) ?? null,
        excluidoEm: r.excluido_em as string,
      }));
    })
  );
  return resultados.flat().sort((a, b) => (a.excluidoEm < b.excluidoEm ? 1 : -1));
}

export async function restaurarItem(item: Pick<ItemLixeira, "tabela" | "id">): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from(item.tabela).update({ excluido_em: null }).eq("id", item.id);
  if (error) throw error;
}

// Ordem importa: remove o arquivo do Storage PRIMEIRO. So apaga o registro
// do banco se isso funcionar (ou se nunca existiu arquivo pra remover) —
// assim nunca sobra arquivo orfao nem registro apontando pra arquivo que
// nao existe mais. Se o Storage falhar, a excecao propaga e o item continua
// na lixeira intacto (quem chama decide como avisar o usuario).
export async function excluirDefinitivamente(item: Pick<ItemLixeira, "tabela" | "id" | "arquivoUrl">): Promise<void> {
  if (item.arquivoUrl && ehCaminhoInterno(item.arquivoUrl)) {
    await removerArquivo(item.arquivoUrl);
  }
  const supabase = supabaseBrowser();
  const { error } = await supabase.from(item.tabela).delete().eq("id", item.id);
  if (error) throw error;
}
