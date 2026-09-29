export type Categoria = "iveasor" | "asor" | "aivil" | "geral";

export type Emocao = "vergonha" | "choque" | "deboche" | "deu_ruim" | "vitoria" | "cansaco" | "ironia";
export type Momento = "gancho" | "transicao" | "punchline" | "fecho";
export type Formato = "vlog" | "gaming" | "grwm";
export type FormaUso = "corte_seco" | "overlay" | "reaction" | "green_screen" | "audio" | "insert";
export type AudioPref = "original" | "mudo" | "so_fala";
export type Intensidade = "sutil" | "media" | "caos";
export type Status = "novo" | "classificado" | "usado";
export type Risco = "baixo" | "medio" | "alto";
export type Orientacao = "vertical" | "horizontal";

export interface Meme {
  id: string;
  titulo: string;
  imagemUrl: string | null;
  linkOrigem: string | null;
  explicacao: string;
  tags: string[];
  criadoEm: string;
  plataforma: string | null;
  criador: string | null;
  categoria: Categoria | null;
  publicadoEm: string | null;

  emocao: Emocao | null;
  momento: Momento | null;
  formatos: Formato[];
  formaUso: FormaUso[];
  audioPref: AudioPref | null;
  ideiaUso: string | null;
  intensidade: Intensidade | null;
  favorito: boolean;
  status: Status;
  risco: Risco | null;

  duracaoSeg: number | null;
  orientacao: Orientacao | null;
  temAudio: boolean | null;
  temFala: boolean | null;

  corteInicio: number | null;
  corteFim: number | null;
}

export interface MemeUso {
  id: string;
  memeId: string;
  contexto: string;
  data: string;
}
