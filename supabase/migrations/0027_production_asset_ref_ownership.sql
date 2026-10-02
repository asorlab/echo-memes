-- Correcao encontrada no teste real de 2 contas da Production (0026):
-- producao_dna_referencias/producao_derivados/producao_broll_sugestoes
-- guardam uma referencia polimorfica (tabela_asset + asset_id) pra um
-- Asset da biblioteca, mas a RLS original so validava ownership do
-- dna_id/projeto_id/bruto_id — NUNCA validava se o asset_id apontado de
-- fato pertence ao usuario. Resultado confirmado ao vivo: a conta B
-- conseguia inserir uma referencia de DNA apontando pro asset_id de A.
--
-- RLS nao aceita nome de tabela dinamico num EXISTS, entao a checagem de
-- ownership do lado "asset" e feita com um EXISTS por tabela possivel,
-- gated pelo valor de tabela_asset (so uma das 6 bate, as outras sao
-- puladas pelo AND tabela_asset = '...'). Tambem restringe tabela_asset
-- aos 6 nomes validos (mesma lista de TABELAS_ASSET em projetos.ts).
--
-- 100% aditivo/corretivo. Nenhum DROP de tabela, so recriacao de policy.
-- Roda inteiro no SQL Editor.

create or replace function producao_asset_pertence_ao_usuario(p_tabela text, p_asset_id uuid, p_user_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select case p_tabela
    when 'memes' then exists (select 1 from memes where id = p_asset_id and user_id = p_user_id)
    when 'audios' then exists (select 1 from audios where id = p_asset_id and user_id = p_user_id)
    when 'visuais' then exists (select 1 from visuais where id = p_asset_id and user_id = p_user_id)
    when 'fontes' then exists (select 1 from fontes where id = p_asset_id and user_id = p_user_id)
    when 'brand_assets' then exists (select 1 from brand_assets where id = p_asset_id and user_id = p_user_id)
    when 'paletas' then exists (select 1 from paletas where id = p_asset_id and user_id = p_user_id)
    else false
  end
$$;

alter table producao_dna_referencias drop constraint if exists producao_dna_referencias_tabela_check;
alter table producao_dna_referencias add constraint producao_dna_referencias_tabela_check
  check (tabela_asset is null or tabela_asset in ('memes', 'audios', 'visuais', 'fontes', 'brand_assets', 'paletas'));
alter table producao_derivados drop constraint if exists producao_derivados_tabela_check;
alter table producao_derivados add constraint producao_derivados_tabela_check
  check (tabela_asset is null or tabela_asset in ('memes', 'audios', 'visuais', 'fontes', 'brand_assets', 'paletas'));
alter table producao_broll_sugestoes drop constraint if exists producao_broll_sugestoes_tabela_check;
alter table producao_broll_sugestoes add constraint producao_broll_sugestoes_tabela_check
  check (tabela_asset is null or tabela_asset in ('memes', 'audios', 'visuais', 'fontes', 'brand_assets', 'paletas'));

drop policy if exists "producao_dna_referencias_owner" on producao_dna_referencias;
create policy "producao_dna_referencias_owner" on producao_dna_referencias for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_referencias.dna_id and producao_editing_dna.user_id = auth.uid())
    and (radar_criador_id is null or exists (select 1 from radar_criadores where radar_criadores.id = producao_dna_referencias.radar_criador_id and radar_criadores.user_id = auth.uid()))
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_referencias.dna_id and producao_editing_dna.user_id = auth.uid())
    and (radar_criador_id is null or exists (select 1 from radar_criadores where radar_criadores.id = producao_dna_referencias.radar_criador_id and radar_criadores.user_id = auth.uid()))
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  );

drop policy if exists "producao_derivados_owner" on producao_derivados;
create policy "producao_derivados_owner" on producao_derivados for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_derivados.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_derivados.bruto_origem_id and producao_brutos.user_id = auth.uid())
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_derivados.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_derivados.bruto_origem_id and producao_brutos.user_id = auth.uid())
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  );

drop policy if exists "producao_broll_sugestoes_owner" on producao_broll_sugestoes;
create policy "producao_broll_sugestoes_owner" on producao_broll_sugestoes for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_broll_sugestoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_broll_sugestoes.momento_id and producao_momentos.user_id = auth.uid()))
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_broll_sugestoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_broll_sugestoes.momento_id and producao_momentos.user_id = auth.uid()))
    and (asset_id is null or producao_asset_pertence_ao_usuario(tabela_asset, asset_id, auth.uid()))
  );

notify pgrst, 'reload schema';
