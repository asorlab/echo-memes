// Busca global (src/lib/busca.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { FONTES_BUSCA, filtroDaBusca, limparTermo } from "../../src/lib/busca.ts";

test("termo perigoso para o filtro e limpo", () => {
  assert.equal(limparTermo("  risada, (alta)* "), "risada alta");
  assert.equal(limparTermo('a"b{c}d\\e:f%'), "a b c d e f");
  assert.equal(limparTermo("x".repeat(100)).length, 60);
});

test("filtro: titulo contem, tag exata em minusculas; menos de 2 letras nao busca", () => {
  assert.equal(filtroDaBusca("Gato", { campoTitulo: "titulo", temTags: true }), "titulo.ilike.*Gato*,tags.cs.{gato}");
  assert.equal(filtroDaBusca("vlog", { campoTitulo: "nome", temTags: false }), "nome.ilike.*vlog*");
  assert.equal(filtroDaBusca("a", { campoTitulo: "titulo", temTags: true }), null);
  assert.equal(filtroDaBusca(" ,, ", { campoTitulo: "titulo", temTags: true }), null);
});

test("cada fonte leva para uma tela que existe", () => {
  for (const f of FONTES_BUSCA) {
    const caminho = f.url("id-teste").split("?")[0].replace("/id-teste", "/[id]");
    const arquivo = caminho === "/" ? "src/app/page.tsx" : `src/app${caminho}/page.tsx`;
    assert.ok(existsSync(arquivo), `${f.tabela} -> ${caminho}`);
  }
});

test("busca cobre biblioteca, referencias, projetos e producao", () => {
  const t = FONTES_BUSCA.map((f) => f.tabela);
  for (const x of ["memes", "audios", "visuais", "fontes", "brand_assets", "paletas", "inspiracoes", "edicoes_referencia", "projetos", "producao_projetos", "producao_editing_dna"]) {
    assert.ok(t.includes(x), x);
  }
});
