// Texto curto para quem usa: o que falhou ao gravar no banco e o que fazer.
// Função pura (scripts/testes/erro-banco.test.mjs).
export function mensagemErroBanco(status: number, msg: string): string {
  const coluna = /column "?([a-z_]+)\.?([a-z_]*)"? (?:of relation "?([a-z_]+)"? )?does not exist/i.exec(msg);
  if (coluna) {
    const nome = coluna[2] ? `${coluna[1]}.${coluna[2]}` : coluna[3] ? `${coluna[3]}.${coluna[1]}` : coluna[1];
    return `Não salvou: falta rodar uma migration no Supabase (coluna ${nome}).`;
  }
  if (/schema cache|relation .* does not exist|Could not find the table/i.test(msg)) return "Não salvou: falta rodar uma migration no Supabase.";
  if (status === 401 || status === 403 || /row-level security|permission denied/i.test(msg)) return "Não salvou: sem permissão para isso nesta conta.";
  if (/check constraint|violates/i.test(msg)) return "Não salvou: algum valor não é aceito.";
  return `Não salvou: ${msg || `erro ${status}`}`;
}
