import { supabaseBrowser } from "./supabase/client";

export type StatusRun = "pending" | "discovering" | "processing" | "completed" | "failed" | "cancelled";
export type StatusItem = "pending" | "downloading" | "completed" | "failed" | "skipped";
export type TipoFonte = "profile" | "hashtag";

export interface Fonte {
  id: string;
  platform: string;
  username: string;
  profileUrl: string;
  tipo: TipoFonte;
  limiteItens: number | null;
  totalImportado: number;
  ultimaSincronizacao: string | null;
  criadoEm: string;
}

export interface Execucao {
  id: string;
  sourceId: string;
  status: StatusRun;
  totalFound: number;
  totalNew: number;
  totalSelected: number;
  limiteSelecionado: number | null;
  totalDownloaded: number;
  totalSkipped: number;
  totalFailed: number;
  errorMessage: string | null;
  errorCategory: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ItemImportado {
  id: string;
  sourceId: string;
  platform: string;
  externalId: string;
  originalUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  caption: string | null;
  status: StatusItem;
  errorMessage: string | null;
  errorCategory: string | null;
  attempts: number;
  memeId: string | null;
  createdAt: string;
}

function mapFonte(r: Record<string, unknown>): Fonte {
  return {
    id: r.id as string,
    platform: r.platform as string,
    username: r.username as string,
    profileUrl: r.profile_url as string,
    tipo: ((r.source_type as string) ?? "profile") as TipoFonte,
    limiteItens: (r.limite_itens as number) ?? null,
    totalImportado: (r.total_imported as number) ?? 0,
    ultimaSincronizacao: (r.last_synced_at as string) ?? null,
    criadoEm: r.created_at as string,
  };
}

function mapExecucao(r: Record<string, unknown>): Execucao {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    status: r.status as StatusRun,
    totalFound: (r.total_found as number) ?? 0,
    totalNew: (r.total_new as number) ?? 0,
    totalSelected: (r.total_selected as number) ?? 0,
    limiteSelecionado: (r.limite_selecionado as number) ?? null,
    totalDownloaded: (r.total_downloaded as number) ?? 0,
    totalSkipped: (r.total_skipped as number) ?? 0,
    totalFailed: (r.total_failed as number) ?? 0,
    errorMessage: (r.error_message as string) ?? null,
    errorCategory: (r.error_category as string) ?? null,
    startedAt: (r.started_at as string) ?? null,
    finishedAt: (r.finished_at as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function mapItem(r: Record<string, unknown>): ItemImportado {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    platform: r.platform as string,
    externalId: r.external_id as string,
    originalUrl: (r.original_url as string) ?? null,
    author: (r.author as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    caption: (r.caption as string) ?? null,
    status: r.status as StatusItem,
    errorMessage: (r.error_message as string) ?? null,
    errorCategory: (r.error_category as string) ?? null,
    attempts: (r.attempts as number) ?? 0,
    memeId: (r.meme_id as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function listarFontes(userId: string): Promise<Fonte[]> {
  const { data, error } = await supabaseBrowser()
    .from("import_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFonte);
}

export async function listarExecucoes(sourceId: string): Promise<Execucao[]> {
  const { data, error } = await supabaseBrowser()
    .from("import_runs")
    .select("*")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(mapExecucao);
}

export async function listarExecucoesRecentes(userId: string): Promise<Execucao[]> {
  const { data, error } = await supabaseBrowser()
    .from("import_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map(mapExecucao);
}

export async function listarItens(sourceId: string): Promise<ItemImportado[]> {
  const { data, error } = await supabaseBrowser()
    .from("import_items")
    .select("*")
    .eq("source_id", sourceId)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(mapItem);
}

// Cria a fonte se ainda nao existir (mesmo platform+username), e sempre
// cria uma nova execucao "pending" pra ela — e essa execucao pendente que,
// mais pra frente, o worker (local por enquanto) vai processar.
export async function adicionarFonteEExecutar(
  userId: string,
  platform: string,
  username: string,
  profileUrl: string,
  tipo: TipoFonte = "profile",
  limiteItens: number | null = null,
  limiteSelecionado: number | null = null,
): Promise<{ fonte: Fonte; execucao: Execucao }> {
  const supabase = supabaseBrowser();
  const { data: existente } = await supabase
    .from("import_sources")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("username", username)
    .maybeSingle();

  let fonteRow = existente;
  if (!fonteRow) {
    const { data, error } = await supabase
      .from("import_sources")
      .insert({ user_id: userId, platform, username, profile_url: profileUrl, source_type: tipo, limite_itens: limiteItens })
      .select("*")
      .single();
    if (error) throw error;
    fonteRow = data;
  }

  const { data: execucao, error: erroExecucao } = await supabase
    .from("import_runs")
    .insert({ source_id: fonteRow.id, user_id: userId, status: "pending", limite_selecionado: limiteSelecionado })
    .select("*")
    .single();
  if (erroExecucao) throw erroExecucao;

  return { fonte: mapFonte(fonteRow), execucao: mapExecucao(execucao) };
}

// limiteSelecionado null = "Importar novos" (sem teto, comportamento
// padrao). Um numero = quantos dos ainda-nao-conhecidos processar nessa
// execucao especifica (usado tanto pra primeira importacao quanto pra
// "Importar mais antigos").
export async function sincronizarFonte(userId: string, sourceId: string, limiteSelecionado: number | null = null): Promise<Execucao> {
  const { data, error } = await supabaseBrowser()
    .from("import_runs")
    .insert({ source_id: sourceId, user_id: userId, status: "pending", limite_selecionado: limiteSelecionado })
    .select("*")
    .single();
  if (error) throw error;
  return mapExecucao(data);
}

export async function cancelarExecucao(runId: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("import_runs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["pending", "discovering", "processing"]);
  if (error) throw error;
}

// Marca o item pra ser reprocessado e cria uma execucao nova pra fonte
// dele — a fase de "processar" de toda execucao pega TODOS os itens
// pending da fonte (nao so os descobertos naquela execucao especifica),
// entao isso entra na fila igual a um item novo, sem duplicar (mesmo
// external_id, so o status volta a ser pending).
export async function tentarItemNovamente(userId: string, itemId: string, sourceId: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error: erroItem } = await supabase
    .from("import_items")
    .update({ status: "pending", error_message: null, error_category: null, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (erroItem) throw erroItem;

  const { error: erroRun } = await supabase
    .from("import_runs")
    .insert({ source_id: sourceId, user_id: userId, status: "pending" });
  if (erroRun) throw erroRun;
}
