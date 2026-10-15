-- ECHO // ASSETS: Production e Editing DNA entram na Lixeira (Fase 0 do Creator OS).
--
-- Antes: excluir bruto, projeto de producao, momento, corte ou DNA apagava a
-- linha de vez (e o video do bruto ficava sobrando no bucket producao-raw).
-- Agora: excluir marca excluido_em; a Lixeira restaura ou remove de vez
-- (arquivo do Storage primeiro, igual as outras bibliotecas).
--
-- So acrescenta coluna e indice. Nao apaga nem altera dado nenhum.
-- As policies existentes (dono-only) continuam valendo para a coluna nova.
-- Roda inteiro no SQL Editor.

alter table producao_brutos      add column if not exists excluido_em timestamptz;
alter table producao_projetos    add column if not exists excluido_em timestamptz;
alter table producao_momentos    add column if not exists excluido_em timestamptz;
alter table producao_clips       add column if not exists excluido_em timestamptz;
alter table producao_editing_dna add column if not exists excluido_em timestamptz;

create index if not exists producao_brutos_lixeira_idx      on producao_brutos (user_id, excluido_em) where excluido_em is not null;
create index if not exists producao_projetos_lixeira_idx    on producao_projetos (user_id, excluido_em) where excluido_em is not null;
create index if not exists producao_momentos_lixeira_idx    on producao_momentos (user_id, excluido_em) where excluido_em is not null;
create index if not exists producao_clips_lixeira_idx       on producao_clips (user_id, excluido_em) where excluido_em is not null;
create index if not exists producao_editing_dna_lixeira_idx on producao_editing_dna (user_id, excluido_em) where excluido_em is not null;

notify pgrst, 'reload schema';
