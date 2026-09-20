export interface Meme {
  id: string;
  titulo: string;
  imagemUrl: string | null;
  linkOrigem: string | null;
  explicacao: string;
  tags: string[];
  criadoEm: string;
}
