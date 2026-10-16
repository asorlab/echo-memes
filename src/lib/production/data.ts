import { supabaseBrowser } from "@/lib/supabase/client";
import { colunaFaltando } from "@/lib/lixeiraConfig";
import type {
  Bruto, ProducaoProjeto, Derivado, Transcricao, SegmentoTranscricao, Momento, Clip, Feedback,
  EditingDna, DnaRegra, DnaReferencia, LegendaPreset, DnaAutoEdit, EditDecision, BrollSugestao,
  ProducaoJob, Publicacao, Metrica, Memoria, Sessao, JobLog, WorkerStatus,
} from "./types";

const sb = () => supabaseBrowser();

type Resposta = { data: unknown; error: { message: string } | null };

// Ate a migration 0031 rodar, excluido_em nao existe nas tabelas de Production:
// a leitura repete sem o filtro em vez de deixar a tela vazia.
async function semExcluidos<T>(consultar: (filtrar: boolean) => PromiseLike<Resposta>): Promise<T[]> {
  let resposta = await consultar(true);
  if (resposta.error && colunaFaltando(resposta.error.message)) resposta = await consultar(false);
  if (resposta.error) throw resposta.error;
  return (resposta.data as T[]) ?? [];
}

// Excluir = mandar para a Lixeira (lib/lixeira.ts restaura ou remove de vez).
async function moverParaLixeira(tabela: string, id: string): Promise<void> {
  const { error } = await sb().from(tabela).update({ excluido_em: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---- Brutos (Inbox) ----
export async function listarBrutos(userId: string): Promise<Bruto[]> {
  return semExcluidos<Bruto>((filtrar) => {
    let q = sb().from("producao_brutos").select("*").eq("user_id", userId);
    if (filtrar) q = q.is("excluido_em", null);
    return q.order("created_at", { ascending: false });
  });
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
  await moverParaLixeira("producao_brutos", id);
}
export async function associarBrutoAoProjeto(userId: string, projetoId: string, brutoId: string): Promise<void> {
  const { error } = await sb().from("producao_projeto_brutos").insert({ user_id: userId, projeto_id: projetoId, bruto_id: brutoId });
  if (error && !error.message.includes("duplicate")) throw error;
  await atualizarBruto(brutoId, { status: "em_projeto" });
}
export async function listarBrutosDoProjeto(projetoId: string): Promise<Bruto[]> {
  const { data, error } = await sb().from("producao_projeto_brutos").select("bruto_id, producao_brutos(*)").eq("projeto_id", projetoId);
  if (error) throw error;
  return ((data ?? []) as unknown as { producao_brutos: Bruto }[]).map((r) => r.producao_brutos).filter((b) => b && !b.excluido_em);
}

// ---- Sessoes de gravacao (0033) ----
export async function listarSessoes(userId: string): Promise<Sessao[]> {
  const { data, error } = await sb().from("producao_sessoes").select("*").eq("user_id", userId).is("excluido_em", null).order("data", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Sessao[]) ?? [];
}
export async function criarSessao(userId: string, patch: Partial<Sessao>): Promise<Sessao> {
  const { data, error } = await sb().from("producao_sessoes").insert({ user_id: userId, nome: "Nova sessão", ...patch }).select().single();
  if (error) throw error;
  return data as Sessao;
}
export async function atualizarSessao(id: string, patch: Partial<Sessao>): Promise<void> {
  const { error } = await sb().from("producao_sessoes").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirSessao(id: string): Promise<void> {
  await moverParaLixeira("producao_sessoes", id);
}
export async function moverBrutoParaSessao(brutoId: string, sessaoId: string | null): Promise<void> {
  const { error } = await sb().from("producao_brutos").update({ sessao_id: sessaoId }).eq("id", brutoId);
  if (error) throw error;
}

// ---- Fila e worker (0033) ----
export async function listarJobsRecentes(userId: string, limite = 60): Promise<ProducaoJob[]> {
  const { data, error } = await sb().from("producao_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return (data as ProducaoJob[]) ?? [];
}
export async function listarLogsDoJob(jobId: string): Promise<JobLog[]> {
  const { data, error } = await sb().from("producao_job_logs").select("*").eq("job_id", jobId).order("created_at");
  if (error) throw error;
  return (data as JobLog[]) ?? [];
}
export async function listarWorkers(userId: string): Promise<WorkerStatus[]> {
  const { data, error } = await sb().from("producao_worker_status").select("*").eq("user_id", userId).order("visto_em", { ascending: false });
  if (error) throw error;
  return (data as WorkerStatus[]) ?? [];
}
// Falhou de vez: volta para a fila do zero (a pessoa decidiu tentar de novo).
export async function tentarJobDeNovo(id: string): Promise<void> {
  const { error } = await sb().from("producao_jobs").update({ status: "queued", tentativas: 0, proximo_em: new Date().toISOString(), erro_mensagem: null, finished_at: null, progresso: 0 }).eq("id", id);
  if (error) throw error;
}
export async function cancelarJob(id: string): Promise<void> {
  const { error } = await sb().from("producao_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "queued");
  if (error) throw error;
}
export async function reprocessarBruto(userId: string, brutoId: string): Promise<void> {
  const { error } = await sb().from("producao_jobs").insert({ user_id: userId, tipo: "ingest", status: "queued", referencia_tabela: "producao_brutos", referencia_id: brutoId, payload: { bruto_id: brutoId } });
  if (error) throw error;
  await atualizarBruto(brutoId, { status: "processando", erro_mensagem: null });
}

// ---- Projetos de producao ----
export async function listarProducaoProjetos(userId: string): Promise<ProducaoProjeto[]> {
  return semExcluidos<ProducaoProjeto>((filtrar) => {
    let q = sb().from("producao_projetos").select("*").eq("user_id", userId);
    if (filtrar) q = q.is("excluido_em", null);
    return q.order("ordem", { ascending: false });
  });
}
export async function obterProducaoProjeto(id: string): Promise<ProducaoProjeto | null> {
  const { data, error } = await sb().from("producao_projetos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const projeto = data as ProducaoProjeto | null;
  return projeto && !projeto.excluido_em ? projeto : null;
}
export async function criarProducaoProjeto(userId: string, titulo: string, extra: { marca_slug?: string } = {}): Promise<ProducaoProjeto> {
  const { data, error } = await sb().from("producao_projetos").insert({ user_id: userId, titulo, ordem: Date.now(), ...extra }).select().single();
  if (error) throw error;
  return data as ProducaoProjeto;
}
export async function atualizarProducaoProjeto(id: string, patch: Partial<ProducaoProjeto>): Promise<void> {
  const { error } = await sb().from("producao_projetos").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirProducaoProjeto(id: string): Promise<void> {
  await moverParaLixeira("producao_projetos", id);
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
  return semExcluidos<Momento>((filtrar) => {
    let q = sb().from("producao_momentos").select("*").eq("bruto_id", brutoId);
    if (filtrar) q = q.is("excluido_em", null);
    return q.order("start_ms");
  });
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
  await moverParaLixeira("producao_momentos", id);
}

// ---- Clips ----
export async function listarClips(projetoId: string): Promise<Clip[]> {
  return semExcluidos<Clip>((filtrar) => {
    let q = sb().from("producao_clips").select("*").eq("projeto_id", projetoId);
    if (filtrar) q = q.is("excluido_em", null);
    return q.order("created_at", { ascending: false });
  });
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
  await moverParaLixeira("producao_clips", id);
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
  return semExcluidos<EditingDna>((filtrar) => {
    let q = sb().from("producao_editing_dna").select("*").eq("user_id", userId);
    if (filtrar) q = q.is("excluido_em", null);
    return q.order("created_at", { ascending: false });
  });
}
export async function criarDna(userId: string, nome: string, extra: { marca_slug?: string } = {}): Promise<EditingDna> {
  const { data, error } = await sb().from("producao_editing_dna").insert({ user_id: userId, nome, ...extra }).select().single();
  if (error) throw error;
  return data as EditingDna;
}
export async function atualizarDna(id: string, patch: Partial<EditingDna>): Promise<void> {
  const { error } = await sb().from("producao_editing_dna").update(patch).eq("id", id);
  if (error) throw error;
}
export async function excluirDna(id: string): Promise<void> {
  await moverParaLixeira("producao_editing_dna", id);
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
// Metricas de varias publicacoes numa consulta so, agrupadas por publicacao (mais recente primeiro).
export async function listarMetricasDePublicacoes(publicacaoIds: string[]): Promise<Record<string, Metrica[]>> {
  if (publicacaoIds.length === 0) return {};
  const { data, error } = await sb().from("producao_metricas").select("*").in("publicacao_id", publicacaoIds).order("captured_at", { ascending: false });
  if (error) throw error;
  const mapa: Record<string, Metrica[]> = {};
  for (const m of (data as Metrica[]) ?? []) (mapa[m.publicacao_id] ??= []).push(m);
  return mapa;
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
