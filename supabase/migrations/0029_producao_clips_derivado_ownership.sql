-- ECHO // ASSETS — Auditoria de seguranca ofensiva, lote 2: producao_clips
-- validava projeto_id/bruto_id/momento_id mas nao derivado_id (nullable,
-- on delete set null) — mesma classe de falha ja corrigida em 0027 pro
-- resto de Production. Nao vaza dado na leitura, o risco e B conseguir
-- vincular o proprio clip a um derivado de A.
-- 100% corretivo, nao apaga nada. Roda inteiro no SQL Editor.

drop policy if exists "producao_clips_owner" on producao_clips;
create policy "producao_clips_owner" on producao_clips for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_clips.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_clips.bruto_id and producao_brutos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_clips.momento_id and producao_momentos.user_id = auth.uid()))
    and (derivado_id is null or exists (select 1 from producao_derivados where producao_derivados.id = producao_clips.derivado_id and producao_derivados.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_clips.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_clips.bruto_id and producao_brutos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_clips.momento_id and producao_momentos.user_id = auth.uid()))
    and (derivado_id is null or exists (select 1 from producao_derivados where producao_derivados.id = producao_clips.derivado_id and producao_derivados.user_id = auth.uid()))
  );

notify pgrst, 'reload schema';
