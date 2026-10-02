// Contratos pequenos pra desacoplar Production de qual provider de IA/
// render a gente acaba usando. Nenhuma implementacao real ainda — so a
// interface, pra poder trocar (Whisper, outro STT, outro renderer) sem
// reescrever o resto do Production. Nunca colocar chave de API aqui nem
// em nenhum arquivo client — um provider real so pode ser implementado
// server-side (rota de API), chamado a partir de um producao_jobs.

export interface SegmentoTranscrito {
  startMs: number;
  endMs: number;
  texto: string;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptionProvider {
  nome: string;
  transcrever(arquivoUrl: string): Promise<SegmentoTranscrito[]>;
}

export interface MomentoSugerido {
  startMs: number;
  endMs: number;
  titulo: string;
  categoria: string;
  reason?: string;
  score?: number;
}

export interface AnalysisProvider {
  nome: string;
  detectarMomentos(arquivoUrl: string, segmentos: SegmentoTranscrito[]): Promise<MomentoSugerido[]>;
}

export interface EspecificacaoRender {
  sourceUrl: string;
  startMs: number;
  endMs: number;
  aspectRatio: "9:16" | "16:9" | "1:1" | "custom";
  editDecisions?: Record<string, unknown>[];
  dnaId?: string;
  legendaPresetId?: string;
}

export interface RenderProvider {
  nome: string;
  renderizar(spec: EspecificacaoRender): Promise<{ arquivoUrl: string }>;
}

// Nenhum provider real registrado ainda — quando existir, entra aqui.
export const TRANSCRIPTION_PROVIDERS: TranscriptionProvider[] = [];
export const ANALYSIS_PROVIDERS: AnalysisProvider[] = [];
export const RENDER_PROVIDERS: RenderProvider[] = [];
