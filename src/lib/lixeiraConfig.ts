// Quais tabelas participam da Lixeira e como ler cada uma. Dados puros
// (scripts/testes/lixeira-config.test.mjs); a leitura e a escrita ficam em lixeira.ts.

export type BucketArquivo = "life-os" | "producao-raw";

export interface ConfigTabela {
  tabela: string;
  rotulo: string;
  campoTitulo: "titulo" | "nome";
  // Coluna com o caminho do arquivo no Storage; null quando a tabela nao guarda arquivo.
  campoArquivo: "imagem_url" | "arquivo_url" | null;
  bucket: BucketArquivo;
  // O que mais some na exclusao definitiva (on delete cascade da 0019/0026).
  aviso?: string;
  // Outros arquivos do registro que tambem saem do Storage (proxy e miniaturas do bruto, 0033).
  arquivosExtras?: { campo: string; bucket: BucketArquivo }[];
}

export const TABELAS_COM_LIXEIRA: ConfigTabela[] = [
  { tabela: "memes", rotulo: "Meme", campoTitulo: "titulo", campoArquivo: "imagem_url", bucket: "life-os" },
  { tabela: "audios", rotulo: "Áudio", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "visuais", rotulo: "Visual", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "fontes", rotulo: "Fonte", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "brand_assets", rotulo: "Brand asset", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "paletas", rotulo: "Paleta", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "inspiracoes", rotulo: "Inspiração", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  { tabela: "edicoes_referencia", rotulo: "Edit", campoTitulo: "titulo", campoArquivo: "arquivo_url", bucket: "life-os" },
  {
    tabela: "projetos", rotulo: "Projeto", campoTitulo: "nome", campoArquivo: null, bucket: "life-os",
    aviso: "Os vínculos com a biblioteca somem junto. Os arquivos da biblioteca ficam.",
  },
  {
    tabela: "producao_brutos", rotulo: "Bruto", campoTitulo: "nome", campoArquivo: "arquivo_url", bucket: "producao-raw",
    aviso: "O vídeo, o proxy e as miniaturas saem do Storage (o original no seu PC não é apagado). Somem junto a transcrição, os momentos e os cortes feitos a partir dele.",
    arquivosExtras: [
      { campo: "proxy_url", bucket: "producao-raw" },
      { campo: "miniatura_url", bucket: "life-os" },
      { campo: "sprite_url", bucket: "life-os" },
    ],
  },
  {
    tabela: "producao_projetos", rotulo: "Produção", campoTitulo: "titulo", campoArquivo: null, bucket: "life-os",
    aviso: "Somem junto os cortes, as publicações e as métricas do projeto. Os brutos ficam.",
  },
  {
    tabela: "producao_sessoes", rotulo: "Sessão", campoTitulo: "nome", campoArquivo: null, bucket: "life-os",
    aviso: "Os brutos da sessão continuam na Inbox, só deixam de estar agrupados.",
  },
  { tabela: "producao_momentos", rotulo: "Momento", campoTitulo: "titulo", campoArquivo: null, bucket: "life-os" },
  { tabela: "producao_clips", rotulo: "Corte", campoTitulo: "nome", campoArquivo: null, bucket: "life-os", aviso: "Os feedbacks do corte somem junto." },
  {
    tabela: "producao_editing_dna", rotulo: "Editing DNA", campoTitulo: "nome", campoArquivo: null, bucket: "life-os",
    aviso: "Somem junto as regras, as referências e o auto-edit do DNA. Projetos que usavam ele ficam sem DNA.",
  },
];

export function configDaTabela(tabela: string): ConfigTabela | undefined {
  return TABELAS_COM_LIXEIRA.find((t) => t.tabela === tabela);
}

// Erro do PostgREST quando a coluna ainda nao existe (migration nao rodou).
export function colunaFaltando(mensagem: string | null | undefined): boolean {
  return /column .* does not exist|could not find the '.*' column/i.test(mensagem ?? "");
}

// Coluna, tabela ou funcao que ainda nao existe: a tela avisa qual migration falta em vez de quebrar.
export function faltaMigration(mensagem: string | null | undefined): boolean {
  return colunaFaltando(mensagem) || /relation .* does not exist|could not find the (table|function)|schema cache/i.test(mensagem ?? "");
}
