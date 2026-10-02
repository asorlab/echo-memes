// Teste ativo de isolamento entre contas para o schema Production (0026).
// Cria 2 contas descartaveis, insere dados como A, tenta ler/alterar/
// relacionar como B, confirma que tudo falha, depois apaga tudo (contas +
// linhas). Roda com: node scripts/testes/production-rls.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

function carregarEnvLocal() {
  const txt = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  for (const linha of txt.split("\n")) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].trim();
  }
}
carregarEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const admin = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

let falhas = 0;
function checar(nome, condicao) {
  console.log(`${condicao ? "OK " : "FALHA "} ${nome}`);
  if (!condicao) falhas++;
}

async function criarContaDescartavel(sufixo) {
  const email = `teste-production-${sufixo}-${Date.now()}@echo.test`;
  const senha = `Teste!${Math.random().toString(36).slice(2)}A1`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  const client = createClient(SUPABASE_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: erroLogin } = await client.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) throw erroLogin;
  return { userId: data.user.id, client };
}

const idsParaLimpar = { userIds: [] };

async function main() {
  const a = await criarContaDescartavel("a");
  const b = await criarContaDescartavel("b");
  idsParaLimpar.userIds.push(a.userId, b.userId);

  // ---- Setup: A cria dados reais em varias tabelas novas ----
  const { data: brutoA, error: e1 } = await a.client.from("producao_brutos").insert({ user_id: a.userId, nome: "bruto de A" }).select().single();
  if (e1) throw e1;
  const { data: projetoA, error: e2 } = await a.client.from("producao_projetos").insert({ user_id: a.userId, titulo: "projeto de A", ordem: 1 }).select().single();
  if (e2) throw e2;
  const { data: dnaA, error: e3 } = await a.client.from("producao_editing_dna").insert({ user_id: a.userId, nome: "DNA de A" }).select().single();
  if (e3) throw e3;
  const { data: memeA, error: e4 } = await a.client.from("memes").insert({ user_id: a.userId, titulo: "meme de A", explicacao: "" }).select().single();
  if (e4) throw e4;
  const { data: pubA, error: e5 } = await a.client.from("producao_publicacoes").insert({ user_id: a.userId, projeto_id: projetoA.id, plataforma: "tiktok" }).select().single();
  if (e5) throw e5;

  // ---- B tenta ler dados de A ----
  const { data: leituraBrutos } = await b.client.from("producao_brutos").select("*").eq("id", brutoA.id);
  checar("B nao consegue ler bruto de A", (leituraBrutos ?? []).length === 0);

  const { data: leituraProjetos } = await b.client.from("producao_projetos").select("*").eq("id", projetoA.id);
  checar("B nao consegue ler projeto de A", (leituraProjetos ?? []).length === 0);

  const { data: leituraDnas } = await b.client.from("producao_editing_dna").select("*").eq("id", dnaA.id);
  checar("B nao consegue ler DNA de A", (leituraDnas ?? []).length === 0);

  // ---- B tenta alterar dados de A ----
  const { error: erroUpdateProjeto, count: countUpdate } = await b.client.from("producao_projetos").update({ titulo: "hackeado" }).eq("id", projetoA.id).select("*", { count: "exact" });
  checar("B nao consegue alterar projeto de A", !!erroUpdateProjeto || (countUpdate ?? 0) === 0);

  const { error: erroDeleteBruto } = await b.client.from("producao_brutos").delete().eq("id", brutoA.id);
  const { data: brutoAindaExiste } = await admin.from("producao_brutos").select("id").eq("id", brutoA.id).maybeSingle();
  checar("B nao consegue excluir bruto de A", !!brutoAindaExiste || !!erroDeleteBruto);

  // ---- B cria proprio projeto/DNA, tenta relacionar com recursos de A ----
  const { data: projetoB } = await b.client.from("producao_projetos").insert({ user_id: b.userId, titulo: "projeto de B", ordem: 1 }).select().single();
  const { data: dnaB } = await b.client.from("producao_editing_dna").insert({ user_id: b.userId, nome: "DNA de B" }).select().single();

  // B tenta criar clip apontando pro bruto de A dentro do proprio projeto de B
  const { error: erroClip } = await b.client.from("producao_clips").insert({
    user_id: b.userId, projeto_id: projetoB.id, bruto_id: brutoA.id, momento_id: null,
    start_ms: 0, end_ms: 1000, nome: "clip malicioso", formato: "tiktok", aspect_ratio: "9:16", status: "draft", derivado_id: null,
  });
  checar("B nao consegue criar clip apontando pro bruto de A", !!erroClip);

  // B tenta associar o asset (meme) de A como referencia do proprio DNA de B
  const { error: erroRefAsset } = await b.client.from("producao_dna_referencias").insert({
    user_id: b.userId, dna_id: dnaB.id, tipo: "asset", tabela_asset: "memes", asset_id: memeA.id,
  });
  checar("B nao consegue referenciar asset de A no proprio DNA", !!erroRefAsset);

  // B tenta criar um derivado no proprio projeto/bruto apontando pro asset (meme) de A
  const { data: brutoB } = await b.client.from("producao_brutos").insert({ user_id: b.userId, nome: "bruto de B" }).select().single();
  const { error: erroDerivadoAssetA } = await b.client.from("producao_derivados").insert({
    user_id: b.userId, projeto_id: projetoB.id, bruto_origem_id: brutoB.id, tipo: "short", tabela_asset: "memes", asset_id: memeA.id,
  });
  checar("B nao consegue criar derivado apontando pro asset de A", !!erroDerivadoAssetA);

  // Controle positivo: source -> derived estrutural real (A cria um derivado a partir do proprio bruto)
  const { data: derivadoA, error: erroDerivadoA } = await a.client.from("producao_derivados").insert({
    user_id: a.userId, projeto_id: projetoA.id, bruto_origem_id: brutoA.id, tipo: "short", arquivo_url: "teste/derivado.mp4",
  }).select().single();
  checar("A consegue criar derivado a partir do proprio bruto (source -> derived)", !erroDerivadoA && !!derivadoA);

  // Controle positivo: A referencia o PROPRIO asset no proprio DNA (fluxo normal, nao deve quebrar)
  const { data: refPropriaA, error: erroRefPropriaA } = await a.client.from("producao_dna_referencias").insert({
    user_id: a.userId, dna_id: dnaA.id, tipo: "asset", tabela_asset: "memes", asset_id: memeA.id,
  }).select().single();
  checar("A consegue referenciar o proprio asset no proprio DNA (controle positivo)", !erroRefPropriaA && !!refPropriaA);

  // Controle positivo: A cria derivado apontando pro proprio asset (fluxo normal, nao deve quebrar)
  const { data: derivadoAssetPropriaA, error: erroDerivadoAssetPropriaA } = await a.client.from("producao_derivados").insert({
    user_id: a.userId, projeto_id: projetoA.id, bruto_origem_id: brutoA.id, tipo: "short", tabela_asset: "memes", asset_id: memeA.id,
  }).select().single();
  checar("A consegue criar derivado apontando pro proprio asset (controle positivo)", !erroDerivadoAssetPropriaA && !!derivadoAssetPropriaA);

  // B tenta criar uma sugestao de b-roll no proprio projeto apontando pro asset (meme) de A
  const { error: erroBrollAssetA } = await b.client.from("producao_broll_sugestoes").insert({
    user_id: b.userId, projeto_id: projetoB.id, sugestao: "broll malicioso", tabela_asset: "memes", asset_id: memeA.id,
  });
  checar("B nao consegue criar sugestao de b-roll apontando pro asset de A", !!erroBrollAssetA);

  // Controle positivo: A cria sugestao de b-roll apontando pro proprio asset (fluxo normal, nao deve quebrar)
  const { data: brollPropriaA, error: erroBrollPropriaA } = await a.client.from("producao_broll_sugestoes").insert({
    user_id: a.userId, projeto_id: projetoA.id, sugestao: "broll de A", tabela_asset: "memes", asset_id: memeA.id,
  }).select().single();
  checar("A consegue criar sugestao de b-roll apontando pro proprio asset (controle positivo)", !erroBrollPropriaA && !!brollPropriaA);

  // B tenta apontar o dna_id do projeto de B pro DNA de A
  const { error: erroDnaProjeto, count: countDnaProjeto } = await b.client.from("producao_projetos").update({ dna_id: dnaA.id }).eq("id", projetoB.id).select("*", { count: "exact" });
  checar("B nao consegue vincular DNA de A ao proprio projeto", !!erroDnaProjeto || (countDnaProjeto ?? 0) === 0);

  // B tenta anexar publicacao ao projeto de A
  const { error: erroPubProjetoA } = await b.client.from("producao_publicacoes").insert({ user_id: b.userId, projeto_id: projetoA.id, plataforma: "tiktok" });
  checar("B nao consegue criar publicacao no projeto de A", !!erroPubProjetoA);

  // B tenta anexar metrica numa publicacao de A
  const { error: erroMetricaPubA } = await b.client.from("producao_metricas").insert({ user_id: b.userId, publicacao_id: pubA.id, views: 999 });
  checar("B nao consegue anexar metrica na publicacao de A", !!erroMetricaPubA);

  // ---- Controle positivo: A realmente consegue ler/alterar o proprio dado ----
  const { data: leituraPropriaA } = await a.client.from("producao_projetos").select("*").eq("id", projetoA.id);
  checar("A consegue ler o proprio projeto (controle positivo)", (leituraPropriaA ?? []).length === 1);

  console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} TESTE(S) FALHARAM`}`);

  // ---- Limpeza ----
  await admin.from("producao_metricas").delete().eq("publicacao_id", pubA.id);
  await admin.from("producao_publicacoes").delete().in("id", [pubA.id]);
  await admin.from("producao_broll_sugestoes").delete().in("projeto_id", [projetoA.id, projetoB.id]);
  await admin.from("producao_dna_referencias").delete().in("dna_id", [dnaA.id, dnaB.id]);
  await admin.from("producao_derivados").delete().in("projeto_id", [projetoA.id, projetoB.id]);
  await admin.from("producao_clips").delete().in("projeto_id", [projetoA.id, projetoB.id]);
  await admin.from("producao_projetos").delete().in("id", [projetoA.id, projetoB.id]);
  await admin.from("producao_editing_dna").delete().in("id", [dnaA.id, dnaB.id]);
  await admin.from("producao_brutos").delete().in("id", [brutoA.id, brutoB?.id].filter(Boolean));
  await admin.from("memes").delete().eq("id", memeA.id);
  for (const uid of idsParaLimpar.userIds) await admin.auth.admin.deleteUser(uid);

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("ERRO NO TESTE:", err.message || err);
  for (const uid of idsParaLimpar.userIds) await admin.auth.admin.deleteUser(uid).catch(() => {});
  process.exit(1);
});
