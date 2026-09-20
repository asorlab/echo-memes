export type Categoria = "iveasor" | "asor" | "aivil" | "geral";

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
}
