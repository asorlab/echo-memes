// Tipos do dominio Production — espelham supabase/migrations/0026_production.sql

export type StatusBruto = "novo" | "em_projeto" | "processando" | "pronto" | "erro";
export interface Bruto {
  id: string; user_id: string; nome: string; arquivo_url: string | null;
  duracao_seg: number | null; origem: string | null; tamanho_bytes: number | null;
  status: StatusBruto; erro_mensagem: string | null; created_at: string;
}

export type TipoProjeto = "vlog" | "grwm" | "fashion" | "gaming" | "cover" | "asmr" | "lifestyle" | "outro";
export type StatusProjeto = "rascunho" | "preparando" | "processando" | "revisao" | "aprovado" | "exportado" | "publicado";
export interface ProducaoProjeto {
  id: string; user_id: string; titulo: string; tipo: TipoProjeto | null; dna_id: string | null;
  status: StatusProjeto; descricao: string | null; data: string | null; observacoes: string | null;
  projeto_id: string | null; ordem: number; created_at: string;
}

export type TipoDerivado = "long_edit" | "short" | "reel" | "tiktok" | "youtube_short" | "thumbnail" | "caption" | "subtitle" | "audio" | "proxy" | "transcript" | "other";
export interface Derivado {
  id: string; user_id: string; projeto_id: string; bruto_origem_id: string;
  tipo: TipoDerivado; versao: number; tabela_asset: string | null; asset_id: string | null;
  arquivo_url: string | null; created_at: string;
}

export type StatusTranscricao = "nao_iniciado" | "processando" | "pronto" | "erro";
export interface Transcricao {
  id: string; user_id: string; bruto_id: string; provider: string | null;
  status: StatusTranscricao; erro_mensagem: string | null; created_at: string;
}
export interface SegmentoTranscricao {
  id: string; transcricao_id: string; user_id: string; start_ms: number; end_ms: number;
  texto: string; speaker: string | null; confidence: number | null; ordem: number; created_at: string;
}

export type CategoriaMomento = "hook" | "engracado" | "fashion" | "grwm" | "historia" | "informativo" | "emocional" | "visual" | "outro";
export type StatusMomento = "sugerido" | "aprovado" | "descartado";
export interface Momento {
  id: string; user_id: string; bruto_id: string; start_ms: number; end_ms: number;
  titulo: string; descricao: string | null; categoria: CategoriaMomento | null;
  score: number | null; reason: string | null; status: StatusMomento; created_at: string;
}

export type FormatoClip = "tiktok" | "reel" | "short" | "youtube" | "custom";
export type AspectRatio = "9:16" | "16:9" | "1:1" | "custom";
export type StatusClip = "draft" | "queued" | "processing" | "review" | "approved" | "rejected" | "exported";
export interface Clip {
  id: string; user_id: string; projeto_id: string; bruto_id: string; momento_id: string | null;
  start_ms: number; end_ms: number; nome: string; formato: FormatoClip; aspect_ratio: AspectRatio;
  status: StatusClip; derivado_id: string | null; created_at: string;
}

export type TipoFeedback = "gostei" | "nao_gostei" | "ajustar";
export interface Feedback {
  id: string; user_id: string; clip_id: string; tipo: TipoFeedback; tags: string[]; comentario: string | null; created_at: string;
}

export interface EditingDna {
  id: string; user_id: string; nome: string; descricao: string | null; ativo: boolean; created_at: string;
}
export type CategoriaDnaRegra = "ritmo" | "jump_cuts" | "silencio" | "legendas" | "zoom" | "transicoes" | "audio" | "cor" | "musica" | "sfx";
export interface DnaRegra {
  id: string; dna_id: string; user_id: string; categoria: CategoriaDnaRegra; regra: string; ordem: number; created_at: string;
}
export interface DnaReferencia {
  id: string; dna_id: string; user_id: string; tipo: "asset" | "radar_criador";
  tabela_asset: string | null; asset_id: string | null; radar_criador_id: string | null; created_at: string;
}
export interface LegendaPreset {
  id: string; dna_id: string; user_id: string; nome: string; fonte_asset_id: string | null;
  tamanho: number | null; posicao: string | null; alinhamento: string | null; max_linhas: number | null;
  destacar_palavras_chave: boolean; caixa: "normal" | "maiuscula" | "minuscula" | null;
  contorno: boolean; sombra: boolean; created_at: string;
}
export interface DnaAutoEdit {
  id: string; dna_id: string; user_id: string;
  remover_silencio_acima_ms: number | null; preservar_silencio_abaixo_ms: number | null;
  jump_cut: boolean; zoom_intensidade_max: number | null; zoom_intervalo_min_ms: number | null;
  plano_duracao_min_ms: number | null; plano_duracao_max_ms: number | null; created_at: string;
}

export type TipoEditDecision = "cut" | "keep" | "zoom" | "caption" | "broll" | "audio" | "transition" | "other";
export interface EditDecision {
  id: string; user_id: string; projeto_id: string; bruto_id: string; tipo: TipoEditDecision;
  start_ms: number; end_ms: number; payload: Record<string, unknown>; ordem: number; created_at: string;
}

export type StatusBroll = "sugerido" | "selecionado" | "ignorado";
export interface BrollSugestao {
  id: string; user_id: string; projeto_id: string; momento_id: string | null; timestamp_ms: number | null;
  sugestao: string; query_descricao: string | null; tabela_asset: string | null; asset_id: string | null;
  status: StatusBroll; created_at: string;
}

export type TipoJob = "transcribe" | "analyze" | "detect_moments" | "render_clip" | "render_long" | "captions" | "normalize_audio" | "tracking" | "export";
export type StatusJob = "queued" | "processing" | "completed" | "failed" | "cancelled";
export interface ProducaoJob {
  id: string; user_id: string; projeto_id: string | null; tipo: TipoJob; status: StatusJob;
  progresso: number; erro_mensagem: string | null; referencia_tabela: string | null; referencia_id: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
}

export type Plataforma = "tiktok" | "instagram" | "youtube" | "outro";
export interface Publicacao {
  id: string; user_id: string; projeto_id: string; clip_id: string | null; plataforma: Plataforma;
  external_id: string | null; url: string | null; titulo_legenda: string | null; published_at: string | null; created_at: string;
}
export interface Metrica {
  id: string; user_id: string; publicacao_id: string; views: number | null; likes: number | null;
  comments: number | null; shares: number | null; saves: number | null; watch_time_seg: number | null;
  avg_watch_time_seg: number | null; completion_rate: number | null; followers_gain: number | null; captured_at: string;
}

export type TipoMemoria = "pessoa" | "lugar" | "serie" | "assunto" | "produto" | "look" | "projeto" | "outro";
export interface Memoria {
  id: string; user_id: string; tipo: TipoMemoria; nome: string; descricao: string | null; created_at: string;
}
