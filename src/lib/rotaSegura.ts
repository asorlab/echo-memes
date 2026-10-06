// Valida o destino depois do login (?next=). So aceita caminho interno do
// proprio app: comeca com "/", nao com "//" nem "/\" (que o navegador trata
// como outro dominio) e, depois de resolvido, continua na mesma origem.
// Evita open redirect do tipo /login?next=//site-malicioso.com.
export function rotaInternaSegura(next: string | null | undefined, padrao: string): string {
  if (!next || typeof next !== "string") return padrao;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return padrao;
  if (/[\u0000-\u001f]/.test(next)) return padrao;
  try {
    const base = "https://assets.interno";
    const url = new URL(next, base);
    if (url.origin !== base) return padrao;
    if (url.pathname.startsWith("/login")) return padrao;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return padrao;
  }
}
