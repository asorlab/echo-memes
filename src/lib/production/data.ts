import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  Bruto, ProducaoProjeto, Derivado, Transcricao, SegmentoTranscricao, Momento, Clip, Feedback,
  EditingDna, DnaRegra, DnaReferencia, LegendaPreset, DnaAutoEdit, EditDecision, BrollSugestao,
  ProducaoJob, Publicacao, Metrica, Memoria,
} from "./types";

const sb = () => supabaseBrowser();

// ---- Brutos (Inbox) ----
export async function listarBrutos(userId: string): Promise<Bruto[]> {
  const { data, error } = await sb().from("producao_brutos").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Bruto[]) ?? [];
}
export async function criarBruto(userId: string, patch: Partial<Bruto>): Promise<Bruto> {
  const { data, error } = await sb().from("producao_brutos").insert({ user_id: userId, nome: "Novo bruto", status: "novo", ...patch }).select().single();
  if (error) throw error;
  return data as Bruto;
}
export async function atualizarBruto(id: string, patch: Partial<Bruto>): Promise<void> {
  const { error } = await sb().from("producao_brutos").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirBruto(id: string): Promise<void> {
  const { error } = await sb().from("producao_brutos").delete().eq("id", id);
  if (error) throw error;
}
export async function associarBrutoAoProjeto(userId: string, projetoId: string, brutoId: string): Promise<void> {
  const { error } = await sb().from("producao_projeto_brutos").insert({ user_id: userId, projeto_id: projetoId, bruto_id: brutoId });
  if (error && !error.message.includes("duplicate")) throw error;
  await atualizarBruto(brutoId, { status: "em_projeto" });
}
export async function listarBrutosDoProjeto(projetoId: string): Promise<Bruto[]> {
  const { data, error } = await sb().from("producao_projeto_brutos").select("bruto_id, producao_brutos(*)").eq("projeto_id", projetoId);
  if (error) throw error;
  return ((data ?? []) as unknown as { producao_brutos: Bruto }[]).map((r) => r.producao_brutos).filter(Boolean);
}

// ---- Projetos de producao ----
export async function listarProducaoProjetos(userId: string): Promise<ProducaoProjeto[]> {
  const { data, error } = await sb().from("producao_projetos").select("*").eq("user_id", userId).order("ordem", { ascending: false });
  if (error) throw error;
  return (data as ProducaoProjeto[]) ?? [];
}
export async function criarProducaoProjeto(userId: string, titulo: string): Promise<ProducaoProjeto> {
  const { data, error } = await sb().from("producao_projetos").insert({ user_id: userId, titulo, ordem: Date.now() }).select().single();
  if (error) throw error;
  return data as ProducaoProjeto;
}
export async function atualizarProducaoProjeto(id: string, patch: Partial<ProducaoProjeto>): Promise<void> {
  const { error } = await sb().from("producao_projetos").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirProducaoProjeto(id: string): Promise<void> {
  const { error } = await sb().from("producao_projetos").delete().eq("id", id);
  if (error) throw error;
}

// ---- Derivados ----
export async function listarDerivadosDoProjeto(projetoId: string): Promise<Derivado[]> {
  const { data, error } = await sb().from("producao_derivados").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Derivado[]) ?? [];
}
export async function criarDerivado(patch: Omit<Derivado, "id" | "created_at">): Promise<Derivado> {
  const { data, error } = await sb().from("producao_derivados").insert(patch).select().single();
  if (error) throw error;
  return data as Derivado;
}

// ---- Transcricao ----
export async function obterTranscricao(brutoId: string): Promise<Transcricao | null> {
  const { data } = await sb().from("producao_transcricoes").select("*").eq("bruto_id", brutoId).maybeSingle();
  return data as Transcricao | null;
}
export async function criarTranscricao(userId: string, brutoId: string): Promise<Transcricao> {
  const { data, error } = await sb().from("producao_transcricoes").insert({ user_id: userId, bruto_id: brutoId, status: "nao_iniciado" }).select().single();
  if (error) throw error;
  return data as Transcricao;
}
export async function listarSegmentos(transcricaoId: string): Promise<SegmentoTranscricao[]> {
  const { data, error } = await sb().from("producao_transcricao_segmentos").select("*").eq("transcricao_id", transcricaoId).order("ordem");
  if (error) throw error;
  return (data as SegmentoTranscricao[]) ?? [];
}
export async function adicionarSegmento(userId: string, transcricaoId: string, patch: Partial<SegmentoTranscricao>): Promise<void> {
  const { error } = await sb().from("producao_transcricao_segmentos").insert({ user_id: userId, transcricao_id: transcricaoId, start_ms: 0, end_ms: 0, texto: "", ...patch });
  if (error) throw error;
}

// ---- Momentos ----
export async function listarMomentos(brutoId: string): Promise<Momento[]> {
  const { data, error } = await sb().from("producao_momentos").select("*").eq("bruto_id", brutoId).order("start_ms");
  if (error) throw error;
  return (data as Momento[]) ?? [];
}
export async function criarMomento(userId: string, brutoId: string, patch: Partial<Momento>): Promise<Momento> {
  const { data, error } = await sb().from("producao_momentos").insert({ user_id: userId, bruto_id: brutoId, start_ms: 0, end_ms: 0, titulo: "Novo momento", status: "sugerido", ...patch }).select().single();
  if (error) throw error;
  return data as Momento;
}
export async function atualizarMomento(id: string, patch: Partial<Momento>): Promise<void> {
  const { error } = await sb().from("producao_momentos").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirMomento(id: string): Promise<void> {
  const { error } = await sb().from("producao_momentos").delete().eq("id", id);
  if (error) throw error;
}

// ---- Clips ----
export async function listarClips(projetoId: string): Promise<Clip[]> {
  const { data, error } = await sb().from("producao_clips").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Clip[]) ?? [];
}
export async function criarClip(patch: Omit<Clip, "id" | "created_at">): Promise<Clip> {
  const { data, error } = await sb().from("producao_clips").insert(patch).select().single();
  if (error) throw error;
  return data as Clip;
}
export async function atualizarClip(id: string, patch: Partial<Clip>): Promise<void> {
  const { error } = await sb().from("producao_clips").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirClip(id: string): Promise<void> {
  const { error } = await sb().from("producao_clips").delete().eq("id", id);
  if (error) throw error;
}

// ---- Feedback ----
export async function listarFeedbacks(clipId: string): Promise<Feedback[]> {
  const { data, error } = await sb().from("producao_feedbacks").select("*").eq("clip_id", clipId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Feedback[]) ?? [];
}
export async function criarFeedback(userId: string, clipId: string, patch: Partial<Feedback>): Promise<void> {
  const { error } = await sb().from("producao_feedbacks").insert({ user_id: userId, clip_id: clipId, tipo: "ajustar", ...patch });
  if (error) throw error;
}

// ---- Editing DNA ----
export async function listarDnas(userId: string): Promise<EditingDna[]> {
  const { data, error } = await sb().from("producao_editing_dna").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as EditingDna[]) ?? [];
}
export async function criarDna(userId: string, nome: string): Promise<EditingDna> {
  const { data, error } = await sb().from("producao_editing_dna").insert({ user_id: userId, nome }).select().single();
  if (error) throw error;
  return data as EditingDna;
}
export async function atualizarDna(id: string, patch: Partial<EditingDna>): Promise<void> {
  const { error } = await sb().from("producao_editing_dna").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirDna(id: string): Promise<void> {
  const { error } = await sb().from("producao_editing_dna").delete().eq("id", id);
  if (error) throw error;
}
export async function listarRegras(dnaId: string): Promise<DnaRegra[]> {
  const { data, error } = await sb().from("producao_dna_regras").select("*").eq("dna_id", dnaId).order("ordem");
  if (error) throw error;
  return (data as DnaRegra[]) ?? [];
}
export async function adicionarRegra(userId: string, dnaId: string, categoria: DnaRegra["categoria"], regra: string): Promise<void> {
  const { error } = await sb().from("producao_dna_regras").insert({ user_id: userId, dna_id: dnaId, categoria, regra, ordem: Date.now() });
  if (error) throw error;
}
export async function excluirRegra(id: string): Promise<void> {
  const { error } = await sb().from("producao_dna_regras").delete().eq("id", id);
  if (error) throw error;
}
export async function listarReferenciasDna(dnaId: string): Promise<DnaReferencia[]> {
  const { data, error } = await sb().from("producao_dna_referencias").select("*").eq("dna_id", dnaId);
  if (error) throw error;
  return (data as DnaReferencia[]) ?? [];
}
export async function adicionarReferenciaAsset(userId: string, dnaId: string, tabelaAsset: string, assetId: string): Promise<void> {
  const { error } = await sb().from("producao_dna_referencias").insert({ user_id: userId, dna_id: dnaId, tipo: "asset", tabela_asset: tabelaAsset, asset_id: assetId });
  if (error) throw error;
}
export async function adicionarReferenciaCriador(userId: string, dnaId: string, radarCriadorId: string): Promise<void> {
  const { error } = await sb().from("producao_dna_referencias").insert({ user_id: userId, dna_id: dnaId, tipo: "radar_criador", radar_criador_id: radarCriadorId });
  if (error) throw error;
}
export async function excluirReferenciaDna(id: string): Promise<void> {
  const { error } = await sb().from("producao_dna_referencias").delete().eq("id", id);
  if (error) throw error;
}
export async function obterLegendaPreset(dnaId: string): Promise<LegendaPreset | null> {
  const { data } = await sb().from("producao_legenda_presets").select("*").eq("dna_id", dnaId).limit(1).maybeSingle();
  return data as LegendaPreset | null;
}
export async function salvarLegendaPreset(userId: string, dnaId: string, existenteId: string | null, patch: Partial<LegendaPreset>): Promise<void> {
  if (existenteId) {
    const { error } = await sb().from("producao_legenda_presets").update(patch).eq("id", existenteId);
    if (error) throw error;
  } else {
    const { error } = await sb().from("producao_legenda_presets").insert({ user_id: userId, dna_id: dnaId, ...patch });
    if (error) throw error;
  }
}
export async function obterAutoEdit(dnaId: string): Promise<DnaAutoEdit | null> {
  const { data } = await sb().from("producao_dna_auto_edit").select("*").eq("dna_id", dnaId).maybeSingle();
  return data as DnaAutoEdit | null;
}
export async function salvarAutoEdit(userId: string, dnaId: string, existenteId: string | null, patch: Partial<DnaAutoEdit>): Promise<void> {
  if (existenteId) {
    const { error } = await sb().from("producao_dna_auto_edit").update(patch).eq("id", existenteId);
    if (error) throw error;
  } else {
    const { error } = await sb().from("producao_dna_auto_edit").insert({ user_id: userId, dna_id: dnaId, ...patch });
    if (error) throw error;
  }
}

// ---- Edit decisions ----
export async function listarEditDecisions(projetoId: string): Promise<EditDecision[]> {
  const { data, error } = await sb().from("producao_edit_decisions").select("*").eq("projeto_id", projetoId).order("ordem");
  if (error) throw error;
  return (data as EditDecision[]) ?? [];
}
export async function criarEditDecision(patch: Omit<EditDecision, "id" | "created_at">): Promise<void> {
  const { error } = await sb().from("producao_edit_decisions").insert(patch);
  if (error) throw error;
}

// ---- B-roll ----
export async function listarBrollSugestoes(projetoId: string): Promise<BrollSugestao[]> {
  const { data, error } = await sb().from("producao_broll_sugestoes").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as BrollSugestao[]) ?? [];
}
export async function criarBrollSugestao(userId: string, projetoId: string, patch: Partial<BrollSugestao>): Promise<void> {
  const { error } = await sb().from("producao_broll_sugestoes").insert({ user_id: userId, projeto_id: projetoId, sugestao: "", status: "sugerido", ...patch });
  if (error) throw error;
}
export async function atualizarBrollSugestao(id: string, patch: Partial<BrollSugestao>): Promise<void> {
  const { error } = await sb().from("producao_broll_sugestoes").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- Jobs ----
export async function listarJobs(projetoId: string): Promise<ProducaoJob[]> {
  const { data, error } = await sb().from("producao_jobs").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProducaoJob[]) ?? [];
}
export async function criarJob(userId: string, patch: Partial<ProducaoJob>): Promise<ProducaoJob> {
  const { data, error } = await sb().from("producao_jobs").insert({ user_id: userId, tipo: "transcribe", status: "queued", progresso: 0, ...patch }).select().single();
  if (error) throw error;
  return data as ProducaoJob;
}

// ---- Publication / Metrics ----
export async function listarPublicacoes(userId: string): Promise<Publicacao[]> {
  const { data, error } = await sb().from("producao_publicacoes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Publicacao[]) ?? [];
}
export async function criarPublicacao(userId: string, projetoId: string, patch: Partial<Publicacao>): Promise<Publicacao> {
  const { data, error } = await sb().from("producao_publicacoes").insert({ user_id: userId, projeto_id: projetoId, plataforma: "tiktok", ...patch }).select().single();
  if (error) throw error;
  return data as Publicacao;
}
export async function atualizarPublicacao(id: string, patch: Partial<Publicacao>): Promise<void> {
  const { error } = await sb().from("producao_publicacoes").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirPublicacao(id: string): Promise<void> {
  const { error } = await sb().from("producao_publicacoes").delete().eq("id", id);
  if (error) throw error;
}
export async function listarMetricas(publicacaoId: string): Promise<Metrica[]> {
  const { data, error } = await sb().from("producao_metricas").select("*").eq("publicacao_id", publicacaoId).order("captured_at", { ascending: false });
  if (error) throw error;
  return (data as Metrica[]) ?? [];
}
export async function adicionarMetrica(userId: string, publicacaoId: string, patch: Partial<Metrica>): Promise<void> {
  const { error } = await sb().from("producao_metricas").insert({ user_id: userId, publicacao_id: publicacaoId, ...patch });
  if (error) throw error;
}

// ---- Creator memory ----
export async function listarMemorias(userId: string): Promise<Memoria[]> {
  const { data, error } = await sb().from("producao_memoria").select("*").eq("user_id", userId).order("nome");
  if (error) throw error;
  return (data as Memoria[]) ?? [];
}
export async function criarMemoria(userId: string, tipo: Memoria["tipo"], nome: string): Promise<Memoria> {
  const { data, error } = await sb().from("producao_memoria").insert({ user_id: userId, tipo, nome }).select().single();
  if (error) throw error;
  return data as Memoria;
}
export async function excluirMemoria(id: string): Promise<void> {
  const { error } = await sb().from("producao_memoria").delete().eq("id", id);
  if (error) throw error;
}
export async function associarMemoriaAoProjeto(userId: string, memoriaId: string, projetoId: string): Promise<void> {
  const { error } = await sb().from("producao_memoria_projetos").insert({ user_id: userId, memoria_id: memoriaId, projeto_id: projetoId });
  if (error && !error.message.includes("duplicate")) throw error;
}
export async function listarMemoriasDoProjeto(projetoId: string): Promise<Memoria[]> {
  const { data, error } = await sb().from("producao_memoria_projetos").select("memoria_id, producao_memoria(*)").eq("projeto_id", projetoId);
  if (error) throw error;
  return ((data ?? []) as unknown as { producao_memoria: Memoria }[]).map((r) => r.producao_memoria).filter(Boolean);
}
