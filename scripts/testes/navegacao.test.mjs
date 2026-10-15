// Menu em 7 grupos (src/lib/navegacao.ts): nenhuma tela existente some.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { GRUPOS_NAV, FORA_DO_MENU, itemAtivo } from "../../src/lib/navegacao.ts";

const hrefs = GRUPOS_NAV.flatMap((g) => g.itens.map((i) => i.href));

test("7 grupos na ordem do plano", () => {
  assert.deepEqual(GRUPOS_NAV.map((g) => g.rotulo), ["Visão Geral", "Produção", "Biblioteca", "Referências", "Studio", "Inteligência", "Sistema"]);
});

test("toda tela de primeiro nivel esta no menu ou e excecao declarada", () => {
  const telas = readdirSync("src/app", { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("[") && d.name !== "api" && existsSync(`src/app/${d.name}/page.tsx`))
    .map((d) => `/${d.name}`);
  telas.push("/");
  for (const t of telas) assert.ok(hrefs.includes(t) || FORA_DO_MENU.includes(t), `${t} sumiu do menu`);
  for (const h of hrefs) assert.ok(h === "/" || existsSync(`src/app${h}/page.tsx`), `${h} no menu sem tela`);
});

test("sem item repetido e sem travessao nos rotulos", () => {
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const g of GRUPOS_NAV) for (const t of [g.rotulo, ...g.itens.map((i) => i.nome)]) assert.ok(!/[–—]/.test(t), t);
});

test("item ativo", () => {
  assert.ok(itemAtivo("/", "/"));
  assert.ok(!itemAtivo("/audios", "/"));
  assert.ok(itemAtivo("/production/abc", "/production"));
  assert.ok(!itemAtivo("/projetosx", "/projetos"));
});
