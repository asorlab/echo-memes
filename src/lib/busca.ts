// Busca global (Ctrl+K). Dados e regras puras: scripts/testes/busca.test.mjs.

export interface FonteBusca {
  tabela: string;
  rotulo: string;
  campoTitulo: "titulo" | "nome";
  temTags: boolean;
  // Coluna antiga que guarda a marca como etiqueta (antes do preenchimento da 0032).
  etiquetaMarca?: string;
  url: (id: string) => string;
}

export const FONTES_BUSCA: FonteBusca[] = [
  { tabela: "memes", rotulo: "Meme", campoTitulo: "titulo", temTags: true, etiquetaMarca: "categoria", url: (id) => `/?abrir=${id}` },
  { tabela: "audios", rotulo: "Áudio", campoTitulo: "titulo", temTags: true, url: (id) => `/audios?abrir=${id}` },
  { tabela: "visuais", rotulo: "Visual", campoTitulo: "titulo", temTags: true, url: (id) => `/visuais?abrir=${id}` },
  { tabela: "fontes", rotulo: "Fonte", campoTitulo: "titulo", temTags: true, url: (id) => `/fontes?abrir=${id}` },
  { tabela: "brand_assets", rotulo: "Brand asset", campoTitulo: "titulo", temTags: true, url: (id) => `/brand?abrir=${id}` },
  { tabela: "paletas", rotulo: "Paleta", campoTitulo: "titulo", temTags: true, url: (id) => `/paletas?abrir=${id}` },
  { tabela: "inspiracoes", rotulo: "Inspiração", campoTitulo: "titulo", temTags: true, etiquetaMarca: "marca", url: (id) => `/inspiracoes?abrir=${id}` },
  { tabela: "edicoes_referencia", rotulo: "Edit", campoTitulo: "titulo", temTags: true, url: (id) => `/edicoes?abrir=${id}` },
  { tabela: "projetos", rotulo: "Projeto", campoTitulo: "nome", temTags: false, url: (id) => `/projetos/${id}` },
  { tabela: "producao_projetos", rotulo: "Produção", campoTitulo: "titulo", temTags: false, url: (id) => `/production/${id}` },
  { tabela: "producao_brutos", rotulo: "Bruto", campoTitulo: "nome", temTags: false, url: () => "/production?tab=inbox" },
  { tabela: "producao_editing_dna", rotulo: "Editing DNA", campoTitulo: "nome", temTags: false, url: (id) => `/editing-dna?abrir=${id}` },
];

// Tira o que quebra o filtro do PostgREST (virgula, parenteses, curinga, chaves, aspas).
export function limparTermo(termo: string): string {
  return termo.replace(/[,()*%{}"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// Filtro "or" do PostgREST: titulo contem o termo, ou uma tag e exatamente o termo.
export function filtroDaBusca(termo: string, fonte: Pick<FonteBusca, "campoTitulo" | "temTags">): string | null {
  const limpo = limparTermo(termo);
  if (limpo.length < 2) return null;
  const partes = [`${fonte.campoTitulo}.ilike.*${limpo}*`];
  if (fonte.temTags) partes.push(`tags.cs.{${limpo.toLowerCase()}}`);
  return partes.join(",");
}
