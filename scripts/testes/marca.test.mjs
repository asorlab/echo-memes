// Marca global (src/lib/marca.ts): aivil e geral sao so etiqueta.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as m from "../../src/lib/marca.ts";

test("etiqueta antiga para marca", () => {
  assert.equal(m.marcaDaEtiqueta("iveasor"), "iveasor");
  assert.equal(m.marcaDaEtiqueta("asor"), "asor_lab");
  assert.equal(m.marcaDaEtiqueta("aivil"), null);
  assert.equal(m.marcaDaEtiqueta("geral"), null);
  assert.equal(m.marcaDaEtiqueta(null), null);
  assert.equal(m.etiquetaDaMarca("asor_lab"), "asor");
  assert.equal(m.etiquetaDaMarca("iveasor"), "iveasor");
  assert.equal(m.etiquetaDaMarca(null), null);
});

test("marca efetiva: coluna nova primeiro, etiqueta enquanto nao preencheu", () => {
  assert.equal(m.marcaDoRegistro("asor_lab", "iveasor"), "asor_lab");
  assert.equal(m.marcaDoRegistro(null, "asor"), "asor_lab");
  assert.equal(m.marcaDoRegistro(undefined, "aivil"), null);
  assert.equal(m.marcaDoRegistro("lixo"), null);
});

test("filtro: compartilhado aparece em todas, cada marca so na sua", () => {
  assert.ok(m.passaNaMarca(null, "iveasor"));
  assert.ok(m.passaNaMarca(null, "asor_lab"));
  assert.ok(m.passaNaMarca("iveasor", "iveasor"));
  assert.ok(!m.passaNaMarca("iveasor", "asor_lab"));
  assert.ok(!m.passaNaMarca("asor_lab", "iveasor"));
  assert.ok(m.passaNaMarca("asor_lab", "todas"));
});

test("seletor so tem IveASOR, ASOR.LAB (e Todas): aivil nao e marca", () => {
  assert.deepEqual(m.MARCAS.map((x) => x.nome), ["IveASOR", "ASOR.LAB"]);
  assert.equal(m.lerFiltroMarca("aivil"), "todas");
  assert.equal(m.lerFiltroMarca("asor_lab"), "asor_lab");
  assert.equal(m.lerFiltroMarca(null), "todas");
  assert.equal(m.nomeMarca(null), "Compartilhado");
});

test("migration 0032 cobre as tabelas e o check bate com as marcas", () => {
  const sql = readFileSync("supabase/migrations/0032_marca_global.sql", "utf8");
  for (const t of ["memes", "audios", "visuais", "fontes", "brand_assets", "paletas", "inspiracoes", "edicoes_referencia", "projetos", "producao_projetos", "producao_editing_dna"]) {
    assert.match(sql, new RegExp(`alter table ${t}\\s+add column if not exists marca_slug text`), t);
  }
  for (const marca of m.MARCAS) assert.ok(sql.includes(`''${marca.slug}''`), marca.slug);
  assert.ok(!/\bdelete\b|\bdrop table\b|drop column/i.test(sql), "0032 nao pode apagar nada");
});
