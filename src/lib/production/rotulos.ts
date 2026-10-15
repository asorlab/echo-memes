// Rotulos em pt-BR dos valores guardados em ingles no banco (0026). O valor
// gravado nao muda; so o que aparece na tela. Teste: scripts/testes/rotulos.test.mjs
import type { CategoriaMomento, FormatoClip, StatusClip, StatusMomento, StatusProjeto, TipoFeedback, TipoProjeto, Plataforma } from "./types";

export const CATEGORIAS_MOMENTO: CategoriaMomento[] = ["hook", "engracado", "fashion", "grwm", "historia", "informativo", "emocional", "visual", "outro"];
export const ROTULO_CATEGORIA_MOMENTO: Record<CategoriaMomento, string> = {
  hook: "Gancho", engracado: "Engraçado", fashion: "Moda", grwm: "Arrume-se comigo", historia: "História",
  informativo: "Informativo", emocional: "Emocional", visual: "Visual", outro: "Outro",
};

export const STATUS_MOMENTO: StatusMomento[] = ["sugerido", "aprovado", "descartado"];
export const ROTULO_STATUS_MOMENTO: Record<StatusMomento, string> = { sugerido: "Sugerido", aprovado: "Aprovado", descartado: "Descartado" };

export const FORMATOS_CLIP: FormatoClip[] = ["tiktok", "reel", "short", "youtube", "custom"];
export const ROTULO_FORMATO_CLIP: Record<FormatoClip, string> = {
  tiktok: "TikTok", reel: "Reels", short: "Shorts", youtube: "YouTube", custom: "Personalizado",
};

export const STATUS_CLIP: StatusClip[] = ["draft", "queued", "processing", "review", "approved", "rejected", "exported"];
export const ROTULO_STATUS_CLIP: Record<StatusClip, string> = {
  draft: "Rascunho", queued: "Na fila", processing: "Processando", review: "Em revisão",
  approved: "Aprovado", rejected: "Descartado", exported: "Exportado",
};

export const TIPOS_FEEDBACK: TipoFeedback[] = ["gostei", "nao_gostei", "ajustar"];
export const ROTULO_TIPO_FEEDBACK: Record<TipoFeedback, string> = { gostei: "Gostei", nao_gostei: "Não gostei", ajustar: "Ajustar" };

export const TIPOS_PROJETO: TipoProjeto[] = ["vlog", "grwm", "fashion", "gaming", "cover", "asmr", "lifestyle", "outro"];
export const ROTULO_TIPO_PROJETO: Record<TipoProjeto, string> = {
  vlog: "Vlog", grwm: "Arrume-se comigo", fashion: "Moda", gaming: "Gameplay", cover: "Cover",
  asmr: "ASMR", lifestyle: "Lifestyle", outro: "Outro",
};

export const STATUS_PROJETO: StatusProjeto[] = ["rascunho", "preparando", "processando", "revisao", "aprovado", "exportado", "publicado"];
export const ROTULO_STATUS_PROJETO: Record<StatusProjeto, string> = {
  rascunho: "Rascunho", preparando: "Preparando", processando: "Processando", revisao: "Revisão",
  aprovado: "Aprovado", exportado: "Exportado", publicado: "Publicado",
};

export const PLATAFORMAS: Plataforma[] = ["tiktok", "instagram", "youtube", "outro"];
export const ROTULO_PLATAFORMA: Record<Plataforma, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", outro: "Outra" };
