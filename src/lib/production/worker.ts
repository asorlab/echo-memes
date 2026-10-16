// Estado do worker do PC e tempo relativo. Puro (scripts/testes/worker-estado.test.mjs).

const MIN = 60_000;

// O worker manda sinal de vida a cada rodada (~15 s). Mais de 2 min sem sinal = desligado.
export function estadoDoWorker(vistoEm: string | null, agoraMs: number): { ligado: boolean; texto: string } {
  if (!vistoEm) return { ligado: false, texto: "Worker do PC nunca foi ligado" };
  const atras = agoraMs - new Date(vistoEm).getTime();
  if (atras <= 2 * MIN) return { ligado: true, texto: "Worker do PC ligado" };
  return { ligado: false, texto: `Worker do PC desligado há ${textoDuracao(atras)}` };
}

export function textoDuracao(ms: number): string {
  const min = Math.max(1, Math.round(ms / MIN));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

export function textoDesde(iso: string, agoraMs: number): string {
  const ms = agoraMs - new Date(iso).getTime();
  if (ms < MIN) return "agora";
  return `há ${textoDuracao(ms)}`;
}
