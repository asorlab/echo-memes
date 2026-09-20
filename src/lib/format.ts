export function parseValorMoeda(texto: string): number {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

export function paraEdicaoMoeda(valor: number): string {
  return String(valor).replace(".", ",");
}
