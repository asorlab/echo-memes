// Tempo de video legivel. Funcoes puras (scripts/testes/timecode.test.mjs).

// 761000 -> "12:41"; 3723000 -> "1:02:03". Negativo ou invalido vira "0:00".
export function formatarTimecode(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Aceita "12:41", "1:02:03", "75" (segundos) e fracao de segundo ("12:41.5").
// Devolve milissegundos, ou null quando o texto nao e um tempo valido.
export function lerTimecode(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(limpo)) return null;
  const partes = limpo.split(":");
  const segundos = Number(partes.pop());
  const minutos = partes.length > 0 ? Number(partes.pop()) : 0;
  const horas = partes.length > 0 ? Number(partes.pop()) : 0;
  if (limpo.includes(":") && (segundos >= 60 || (horas > 0 && minutos >= 60))) return null;
  return Math.round(((horas * 60 + minutos) * 60 + segundos) * 1000);
}
