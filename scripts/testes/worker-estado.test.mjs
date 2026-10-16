// Estado do worker na tela (src/lib/production/worker.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { estadoDoWorker, textoDuracao, textoDesde } from "../../src/lib/production/worker.ts";

const agora = Date.parse("2026-10-15T20:00:00Z");
const antes = (ms) => new Date(agora - ms).toISOString();

test("ligado ate 2 min sem sinal; depois diz ha quanto tempo", () => {
  assert.deepEqual(estadoDoWorker(antes(30_000), agora), { ligado: true, texto: "Worker do PC ligado" });
  assert.equal(estadoDoWorker(antes(10 * 60_000), agora).texto, "Worker do PC desligado há 10 min");
  assert.equal(estadoDoWorker(antes(5 * 3600_000), agora).ligado, false);
  assert.equal(estadoDoWorker(null, agora).texto, "Worker do PC nunca foi ligado");
});

test("duracao legivel e sem travessao", () => {
  assert.equal(textoDuracao(30_000), "1 min");
  assert.equal(textoDuracao(90 * 60_000), "2 h");
  assert.equal(textoDuracao(72 * 3600_000), "3 dias");
  assert.equal(textoDesde(antes(10_000), agora), "agora");
  assert.equal(textoDesde(antes(3 * 60_000), agora), "há 3 min");
  assert.ok(!/[–—]/.test(estadoDoWorker(antes(10 * 60_000), agora).texto));
});
