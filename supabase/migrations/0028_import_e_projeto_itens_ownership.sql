-- ECHO // ASSETS — Auditoria de seguranca ofensiva (30/09): RLS de
-- import_runs/import_items/projeto_itens validava so `auth.uid() = user_id`
-- (dono da LINHA), nunca se o `source_id`/`projeto_id` referenciado de fato
-- pertence a esse mesmo usuario. Mesma classe de falha ja corrigida em
-- 0027 pra producao_dna_referencias/derivados/broll_sugestoes.
--
-- IMPACTO REAL CONFIRMADO (nao teorico) em import_runs/import_items:
-- scripts/import-worker.mjs roda com service role (ignora RLS) e processa
-- QUALQUER import_runs 'pending' (sem filtrar por user_id — linha
-- `proximaExecucaoPendente`), carregando a fonte por `source_id` e usando
-- `fonte.user_id` como identidade confiavel pra TUDO: caminho no Storage,
-- dono do meme criado, tudo. Se a conta B inserisse um import_runs (ou
-- import_items) apontando pro source_id de A, o worker executaria a
-- sincronizacao/download e criaria memes DENTRO da biblioteca de A. A
-- mitigacao pratica ate agora era so o UUID do source_id nao ser
-- descoberto por B em lugar nenhum (import_sources ja e owner-only) — mas
-- RLS nunca deveria depender de um UUID permanecer secreto.
--
-- Em projeto_itens: sem o check, B podia inserir uma linha com o
-- projeto_id de A (unique(projeto_id, tabela_origem, item_id) ocupado por
-- uma linha que nao e de A) — A nunca ve a linha de B (RLS ja filtra por
-- user_id na leitura), mas o INSERT legitimo de A pro mesmo item falha
-- com violacao de unicidade, sem explicacao visivel.
--
-- Nao apaga nem altera dado nenhum — so recria as 3 policies acrescentando
-- a validacao do lado que faltava. Roda inteiro no SQL Editor.

drop policy if exists "dono ve so as proprias execucoes" on import_runs;
create policy "dono ve so as proprias execucoes" on import_runs for all
  using (
    auth.uid() = user_id
    and exists (select 1 from import_sources where import_sources.id = import_runs.source_id and import_sources.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from import_sources where import_sources.id = import_runs.source_id and import_sources.user_id = auth.uid())
  );

drop policy if exists "dono ve so os proprios itens" on import_items;
create policy "dono ve so os proprios itens" on import_items for all
  using (
    auth.uid() = user_id
    and exists (select 1 from import_sources where import_sources.id = import_items.source_id and import_sources.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from import_sources where import_sources.id = import_items.source_id and import_sources.user_id = auth.uid())
  );

drop policy if exists "dono ve so os proprios itens de projeto" on projeto_itens;
create policy "dono ve so os proprios itens de projeto" on projeto_itens for all
  using (
    auth.uid() = user_id
    and exists (select 1 from projetos where projetos.id = projeto_itens.projeto_id and projetos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from projetos where projetos.id = projeto_itens.projeto_id and projetos.user_id = auth.uid())
  );

notify pgrst, 'reload schema';
