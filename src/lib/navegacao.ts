// Menu do Creator OS em 7 grupos (plano, secao 4.2). Dado puro: o teste
// scripts/testes/navegacao.test.mjs garante que nenhuma tela existente some do menu.

export interface ItemNav { id: string; nome: string; href: string }
export interface GrupoNav { id: string; rotulo: string; itens: ItemNav[] }

export const GRUPOS_NAV: GrupoNav[] = [
  { id: "visao", rotulo: "Visão Geral", itens: [{ id: "inicio", nome: "Início", href: "/inicio" }] },
  { id: "producao", rotulo: "Produção", itens: [{ id: "production", nome: "Production", href: "/production" }] },
  {
    id: "biblioteca", rotulo: "Biblioteca", itens: [
      { id: "memes", nome: "Memes", href: "/" },
      { id: "audios", nome: "Áudios", href: "/audios" },
      { id: "visuais", nome: "Visuais", href: "/visuais" },
      { id: "fontes", nome: "Fontes", href: "/fontes" },
      { id: "brand", nome: "Brand Assets", href: "/brand" },
      { id: "paletas", nome: "Paletas", href: "/paletas" },
    ],
  },
  {
    id: "referencias", rotulo: "Referências", itens: [
      { id: "contas", nome: "Contas", href: "/contas" },
      { id: "edicoes", nome: "Edits", href: "/edicoes" },
      { id: "inspiracoes", nome: "Inspirações", href: "/inspiracoes" },
      { id: "refs", nome: "Refs", href: "/refs" },
    ],
  },
  {
    id: "studio", rotulo: "Studio", itens: [
      { id: "projetos", nome: "Projetos", href: "/projetos" },
      { id: "editing-dna", nome: "Editing DNA", href: "/editing-dna" },
    ],
  },
  { id: "inteligencia", rotulo: "Inteligência", itens: [{ id: "analytics", nome: "Analytics", href: "/analytics" }] },
  { id: "sistema", rotulo: "Sistema", itens: [{ id: "lixeira", nome: "Lixeira", href: "/lixeira" }] },
];

// Telas que de proposito nao ficam no menu.
export const FORA_DO_MENU = ["/login", "/sem-acesso", "/templates"]; // templates = filtro dentro de Visuais

export function itemAtivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
