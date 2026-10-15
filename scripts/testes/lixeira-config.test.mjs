// Lixeira cobre bibliotecas, projetos e Production (src/lib/lixeiraConfig.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { TABELAS_COM_LIXEIRA as T, configDaTabela, colunaFaltando } from "../../src/lib/lixeiraConfig.ts";

const tabelas = T.map((t) => t.tabela);

test("todas as tabelas que pedem Lixeira estao la, sem repetir", () => {
  for (const t of ["memes", "audios", "visuais", "fontes", "brand_assets", "paletas", "inspiracoes", "edicoes_referencia",
    "projetos", "producao_brutos", "producao_projetos", "producao_momentos", "producao_clips", "producao_editing_dna"]) {
    assert.ok(tabelas.includes(t), `${t} fora da Lixeira`);
  }
  assert.equal(new Set(tabelas).size, tabelas.length);
});

test("bruto apaga o video no bucket certo e avisa o que vai junto", () => {
  const bruto = configDaTabela("producao_brutos");
  assert.equal(bruto.bucket, "producao-raw");
  assert.equal(bruto.campoArquivo, "arquivo_url");
  assert.match(bruto.aviso, /Storage/);
  assert.equal(configDaTabela("memes").campoArquivo, "imagem_url");
  assert.equal(configDaTabela("producao_projetos").campoArquivo, null);
  assert.equal(configDaTabela("nao_existe"), undefined);
});

test("textos sem travessao", () => {
  for (const t of T) for (const texto of [t.rotulo, t.aviso ?? ""]) assert.ok(!/[–—]/.test(texto), `${t.tabela}: ${texto}`);
});

test("toda tabela de Production na Lixeira ganha excluido_em em alguma migration", () => {
  const sql = readdirSync("supabase/migrations").map((a) => readFileSync(`supabase/migrations/${a}`, "utf8")).join("\n");
  for (const t of tabelas.filter((n) => n.startsWith("producao_"))) {
    assert.match(sql, new RegExp(`alter table ${t}\\s+add column if not exists excluido_em`), `${t} sem excluido_em`);
  }
});

test("reconhece coluna que falta (migration nao rodou)", () => {
  assert.ok(colunaFaltando("column producao_brutos.excluido_em does not exist"));
  assert.ok(colunaFaltando("Could not find the 'excluido_em' column of 'producao_clips' in the schema cache"));
  assert.ok(!colunaFaltando("new row violates row-level security policy"));
  assert.ok(!colunaFaltando(null));
});
