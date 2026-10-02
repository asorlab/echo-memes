import { supabaseBrowser } from "./supabase/client";
import { resolverUrl, urlsAssinadas } from "./storage";

export type TipoConteudo = "vlog" | "grwm" | "gaming" | "asmr" | "cover" | "lifestyle" | "outro";
export type StatusProjeto = "planejamento" | "em_andamento" | "concluido" | "arquivado";
export type PapelItem = "referencia" | "planejado" | "usado";

export interface Projeto {
  id: string;
  nome: string;
  tipoConteudo: TipoConteudo | null;
  status: StatusProjeto;
  observacoes: string | null;
  dataPrevista: string | null;
  criadoEm: string;
}

// Tabelas que contam como "asset" (planejado/usado) vs "referencia" no
// seletor de busca da biblioteca — mesma distincao conceitual da auditoria
// (Referencias != Asset operacional).
export const TABELAS_ASSET = ["memes", "audios", "visuais", "fontes", "brand_assets", "paletas"] as const;
export const TABELAS_REFERENCIA = ["edicoes_referencia", "inspiracoes"] as const;
export type TabelaOrigem = (typeof TABELAS_ASSET)[number] | (typeof TABELAS_REFERENCIA)[number];

const ROTULO_TABELA: Record<TabelaOrigem, string> = {
  memes: "Meme", audios: "Áudio", visuais: "Visual", fontes: "Fonte", brand_assets: "Brand asset", paletas: "Paleta",
  edicoes_referencia: "Referência", inspiracoes: "Inspiração",
};
const CAMPO_ARQUIVO: Record<TabelaOrigem, "imagem_url" | "arquivo_url"> = {
  memes: "imagem_url", audios: "arquivo_url", visuais: "arquivo_url", fontes: "arquivo_url", brand_assets: "arquivo_url",
  paletas: "arquivo_url", edicoes_referencia: "arquivo_url", inspiracoes: "arquivo_url",
};

export interface ItemBiblioteca {
  id: string;
  tabelaOrigem: TabelaOrigem;
  rotuloTabela: string;
  titulo: string;
  arquivoUrl: string | null;
}

export interface ItemProjeto extends ItemBiblioteca {
  itemProjetoId: string;
  papel: PapelItem;
  urlAssinada?: string;
}

function mapProjeto(r: Record<string, unknown>): Projeto {
  return {
    id: r.id as string,
    nome: r.nome as string,
    tipoConteudo: (r.tipo_conteudo as TipoConteudo) ?? null,
    status: r.status as StatusProjeto,
    observacoes: (r.observacoes as string) ?? null,
    dataPrevista: (r.data_prevista as string) ?? null,
    criadoEm: r.created_at as string,
  };
}

export async function listarProjetos(userId: string): Promise<Projeto[]> {
  const { data, error } = await supabaseBrowser()
    .from("projetos").select("*").eq("user_id", userId).is("excluido_em", null).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProjeto);
}

export async function criarProjeto(userId: string, nome: string, tipoConteudo: TipoConteudo | null): Promise<Projeto> {
  const { data, error } = await supabaseBrowser()
    .from("projetos").insert({ user_id: userId, nome, tipo_conteudo: tipoConteudo }).select("*").single();
  if (error) throw error;
  return mapProjeto(data);
}

export async function atualizarProjeto(id: string, patch: Partial<{
  nome: string; tipo_conteudo: TipoConteudo | null; status: StatusProjeto; observacoes: string | null; data_prevista: string | null;
}>): Promise<void> {
  const { error } = await supabaseBrowser().from("projetos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Soft-delete so do container — projeto_itens some junto (on delete cascade
// so dispara em delete de verdade, mas como so o container fica invisivel e
// os assets originais nunca foram guardados aqui, nada de real e perdido).
export async function excluirProjeto(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("projetos").update({ excluido_em: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function listarItensProjeto(projetoId: string): Promise<ItemProjeto[]> {
  const { data, error } = await supabaseBrowser().from("projeto_itens").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: true });
  if (error) throw error;
  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const porTabela: Record<string, string[]> = {};
  for (const l of linhas) (porTabela[l.tabela_origem] ??= []).push(l.item_id);

  const registros: Record<string, Record<string, unknown>> = {};
  await Promise.all(Object.entries(porTabela).map(async ([tabela, ids]) => {
    const campo = CAMPO_ARQUIVO[tabela as TabelaOrigem];
    const { data: itens, error } = await supabaseBrowser().from(tabela).select(`id, titulo, ${campo}`).in("id", ids);
    if (error) { console.error(`projetos: erro lendo ${tabela}`, error.message); return; }
    for (const it of itens ?? []) registros[`${tabela}:${it.id}`] = it;
  }));

  const arquivos: (string | null)[] = [];
  const resultado: ItemProjeto[] = linhas.map((l) => {
    const tabela = l.tabela_origem as TabelaOrigem;
    const registro = registros[`${tabela}:${l.item_id}`];
    const campo = CAMPO_ARQUIVO[tabela];
    const arquivoUrl = registro ? ((registro[campo] as string) ?? null) : null;
    arquivos.push(arquivoUrl);
    return {
      id: l.item_id, itemProjetoId: l.id, papel: l.papel as PapelItem,
      tabelaOrigem: tabela, rotuloTabela: ROTULO_TABELA[tabela] ?? tabela,
      titulo: registro ? ((registro.titulo as string) || "(sem título)") : "(item removido da biblioteca)",
      arquivoUrl,
    };
  });

  const urls = await urlsAssinadas(arquivos);
  return resultado.map((r) => ({ ...r, urlAssinada: resolverUrl(r.arquivoUrl, urls) }));
}

export async function adicionarItemProjeto(userId: string, projetoId: string, papel: PapelItem, item: ItemBiblioteca): Promise<void> {
  const { error } = await supabaseBrowser().from("projeto_itens").upsert(
    { projeto_id: projetoId, user_id: userId, papel, tabela_origem: item.tabelaOrigem, item_id: item.id },
    { onConflict: "projeto_id,tabela_origem,item_id" },
  );
  if (error) throw error;
}

export async function atualizarPapelItem(itemProjetoId: string, papel: PapelItem): Promise<void> {
  const { error } = await supabaseBrowser().from("projeto_itens").update({ papel, updated_at: new Date().toISOString() }).eq("id", itemProjetoId);
  if (error) throw error;
}

export async function removerItemProjeto(itemProjetoId: string): Promise<void> {
  const { error } = await supabaseBrowser().from("projeto_itens").delete().eq("id", itemProjetoId);
  if (error) throw error;
}

// Busca simples por titulo em varias tabelas da biblioteca de uma vez —
// alimenta o seletor "+ Referência"/"+ Asset" dentro do projeto.
export async function buscarNaBiblioteca(userId: string, termo: string, escopo: "asset" | "referencia"): Promise<ItemBiblioteca[]> {
  const tabelas: readonly TabelaOrigem[] = escopo === "asset" ? TABELAS_ASSET : TABELAS_REFERENCIA;
  const supabase = supabaseBrowser();
  const resultados = await Promise.all(tabelas.map(async (tabela) => {
    const campo = CAMPO_ARQUIVO[tabela];
    let query = supabase.from(tabela).select(`id, titulo, ${campo}`).eq("user_id", userId).is("excluido_em", null).order("created_at", { ascending: false }).limit(8);
    if (termo.trim()) query = query.ilike("titulo", `%${termo.trim()}%`);
    const { data, error } = await query;
    if (error) { console.error(`buscarNaBiblioteca: erro em ${tabela}`, error.message); return []; }
    return ((data ?? []) as Record<string, unknown>[]).map((r): ItemBiblioteca => ({
      id: r.id as string, tabelaOrigem: tabela, rotuloTabela: ROTULO_TABELA[tabela],
      titulo: (r.titulo as string) || "(sem título)", arquivoUrl: (r[campo] as string) ?? null,
    }));
  }));
  return resultados.flat();
}
