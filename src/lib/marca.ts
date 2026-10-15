// Marca global do Creator OS. Regras puras (scripts/testes/marca.test.mjs).
//
// marca_slug (migration 0032) vale para todas as bibliotecas e projetos:
//   "iveasor" | "asor_lab" = da marca; null = compartilhado (aparece nas duas).
// As colunas antigas continuam: memes.categoria e inspiracoes.marca guardam a
// etiqueta (iveasor, asor, aivil, geral). aivil e geral sao so etiqueta: nao
// viram marca, entao o item fica compartilhado.

export type MarcaSlug = "iveasor" | "asor_lab";
export type FiltroMarca = MarcaSlug | "todas";

export const MARCAS: { slug: MarcaSlug; nome: string }[] = [
  { slug: "iveasor", nome: "IveASOR" },
  { slug: "asor_lab", nome: "ASOR.LAB" },
];

export function ehMarca(valor: unknown): valor is MarcaSlug {
  return valor === "iveasor" || valor === "asor_lab";
}

export function nomeMarca(slug: string | null | undefined): string {
  return MARCAS.find((m) => m.slug === slug)?.nome ?? "Compartilhado";
}

export function lerFiltroMarca(valor: string | null | undefined): FiltroMarca {
  return ehMarca(valor) ? valor : "todas";
}

// Etiqueta antiga para marca: "asor" e "iveasor" viram marca; aivil, geral e vazio, nao.
export function marcaDaEtiqueta(etiqueta: string | null | undefined): MarcaSlug | null {
  if (etiqueta === "iveasor") return "iveasor";
  if (etiqueta === "asor") return "asor_lab";
  return null;
}

// Marca para etiqueta antiga (para gravar as duas colunas juntas num item novo).
export function etiquetaDaMarca(marca: MarcaSlug | null): "iveasor" | "asor" | null {
  return marca === "iveasor" ? "iveasor" : marca === "asor_lab" ? "asor" : null;
}

// Marca efetiva de um registro: a coluna nova, ou a etiqueta antiga enquanto o preenchimento nao rodou.
export function marcaDoRegistro(marcaSlug: unknown, etiquetaAntiga?: unknown): MarcaSlug | null {
  if (ehMarca(marcaSlug)) return marcaSlug;
  return marcaDaEtiqueta(typeof etiquetaAntiga === "string" ? etiquetaAntiga : null);
}

// O item aparece com esse filtro? Compartilhado aparece em todas.
export function passaNaMarca(marcaItem: MarcaSlug | null, filtro: FiltroMarca): boolean {
  return filtro === "todas" || marcaItem === null || marcaItem === filtro;
}
