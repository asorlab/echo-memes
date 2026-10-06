-- ECHO // ASSETS: Inspiracoes ganham MARCA e vinculo com o Banco de ideias
-- do ECHO OS.
--
-- 1) marca: em Memes, "categoria" e a marca (iveasor/asor/aivil/geral), mas
--    em Inspiracoes "categoria" ja era o formato (video/imagem/texto...).
--    Por isso nao dava pra filtrar inspiracao por marca. Coluna nova e
--    separada, sem mexer no que ja existe.
-- 2) ideia_id: quando a inspiracao vira ideia no ECHO OS (os_ideias, mesmo
--    banco), guarda qual ideia foi criada. Se a ideia for apagada la, o
--    vinculo some sozinho (on delete set null).
-- 3) RLS: recria a policy exigindo que a ideia vinculada seja do mesmo
--    usuario (mesmo padrao de 0027/0028/0029).
--
-- Nao apaga nem altera dado nenhum. Roda inteiro no SQL Editor.

alter table inspiracoes add column if not exists marca text;
alter table inspiracoes drop constraint if exists inspiracoes_marca_check;
alter table inspiracoes add constraint inspiracoes_marca_check
  check (marca in ('iveasor', 'asor', 'aivil', 'geral'));

alter table inspiracoes add column if not exists ideia_id uuid references os_ideias(id) on delete set null;

drop policy if exists "dono ve so os proprios dados" on inspiracoes;
create policy "dono ve so os proprios dados" on inspiracoes for all
  using (
    auth.uid() = user_id
    and (ideia_id is null or exists (select 1 from os_ideias where os_ideias.id = inspiracoes.ideia_id and os_ideias.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and (ideia_id is null or exists (select 1 from os_ideias where os_ideias.id = inspiracoes.ideia_id and os_ideias.user_id = auth.uid()))
  );

notify pgrst, 'reload schema';
