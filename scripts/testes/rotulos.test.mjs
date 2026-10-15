// Todo valor do banco tem rotulo em pt-BR na tela (src/lib/production/rotulos.ts).
import test from "node:test";
import assert from "node:assert/strict";
import * as r from "../../src/lib/production/rotulos.ts";

const pares = [
  ["CATEGORIAS_MOMENTO", "ROTULO_CATEGORIA_MOMENTO"],
  ["STATUS_MOMENTO", "ROTULO_STATUS_MOMENTO"],
  ["FORMATOS_CLIP", "ROTULO_FORMATO_CLIP"],
  ["STATUS_CLIP", "ROTULO_STATUS_CLIP"],
  ["TIPOS_FEEDBACK", "ROTULO_TIPO_FEEDBACK"],
  ["TIPOS_PROJETO", "ROTULO_TIPO_PROJETO"],
  ["STATUS_PROJETO", "ROTULO_STATUS_PROJETO"],
  ["PLATAFORMAS", "ROTULO_PLATAFORMA"],
];

test("cada valor tem rotulo, sem sobra", () => {
  for (const [lista, mapa] of pares) {
    assert.deepEqual([...r[lista]].sort(), Object.keys(r[mapa]).sort(), `${lista} x ${mapa}`);
  }
});

test("rotulo nao e o valor cru em ingles nem usa travessao", () => {
  const crus = ["draft", "queued", "processing", "review", "approved", "rejected", "exported", "custom", "hook", "nao_gostei"];
  for (const [, mapa] of pares) {
    for (const [valor, rotulo] of Object.entries(r[mapa])) {
      assert.ok(rotulo.trim().length > 0, `${valor} sem rotulo`);
      assert.ok(!crus.includes(rotulo), `${valor} aparece cru: ${rotulo}`);
      assert.ok(!/[–—]/.test(rotulo), `${valor} com travessao`);
    }
  }
});
