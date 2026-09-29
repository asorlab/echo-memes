-- ECHO // ASSETS — consolida SFX dentro de Audios (campo "tipo": sfx,
-- musica, fala, trend, ambiente). Preserva os dados que ja existiam em sfx
-- e sfx_usos, migrando pra audios/audios_usos, depois remove as tabelas
-- antigas. Roda inteiro no SQL Editor.

alter table audios add column if not exists tipo text
  check (tipo in ('sfx', 'musica', 'fala', 'trend', 'ambiente'));
alter table audios add column if not exists categoria_sfx text
  check (categoria_sfx in ('whoosh', 'impacto', 'notificacao', 'transicao', 'risada', 'erro', 'sucesso', 'ambiente', 'outro'));
update audios set tipo = 'musica' where tipo is null;

alter table audios add column if not exists sfx_id_antigo uuid;

insert into audios (user_id, titulo, arquivo_url, tipo, categoria_sfx, momento, risco, duracao_seg, tags, link_origem, favorito, created_at, sfx_id_antigo)
select user_id, titulo, arquivo_url, 'sfx', categoria, momento, risco, duracao_seg, tags, link_origem, favorito, created_at, id
from sfx;

insert into audios_usos (audio_id, user_id, contexto, data, created_at)
select a.id, su.user_id, su.contexto, su.data, su.created_at
from sfx_usos su join audios a on a.sfx_id_antigo = su.sfx_id;

alter table audios drop column sfx_id_antigo;

drop table if exists sfx_usos;
drop table if exists sfx;

notify pgrst, 'reload schema';
