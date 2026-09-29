-- ECHO // ASSETS — consolida Shots e Hooks dentro de Inspiracoes, como uma
-- classificacao separada "tipo_inspiracao" (por que salvei) distinta do
-- "categoria" ja existente (formato: video/imagem/texto/conta/outro).
-- Tambem adiciona status (quero testar/testado), formatos de conteudo
-- (Vlog/GRWM/Gaming/Lifestyle/Cover/ASMR/Short-form) e creator/plataforma.
-- Preserva os dados migrando de shots/hooks, depois remove as tabelas antigas.
-- Roda inteiro no SQL Editor.

alter table inspiracoes add column if not exists tipo_inspiracao text
  check (tipo_inspiracao in ('hook', 'shot_enquadramento', 'look', 'cenario', 'pose', 'thumbnail', 'storytelling', 'estetica', 'ideia_video', 'creator_conta', 'outro'));
alter table inspiracoes add column if not exists status text check (status in ('quero_testar', 'testado'));
alter table inspiracoes add column if not exists formato_conteudo text[] not null default '{}';
alter table inspiracoes add column if not exists plataforma text;
alter table inspiracoes add column if not exists criador text;

-- shots -> inspiracoes (formato imagem, tipo shot_enquadramento)
insert into inspiracoes (user_id, titulo, arquivo_url, link_origem, categoria, tipo_inspiracao, tags, favorito, created_at)
select user_id, titulo, arquivo_url, link_origem, 'imagem', 'shot_enquadramento', tags, favorito, created_at
from shots;

-- hooks -> inspiracoes (formato texto, tipo hook, guarda a transcricao na nota)
insert into inspiracoes (user_id, titulo, link_origem, categoria, tipo_inspiracao, nota, tags, favorito, created_at)
select user_id, titulo, link_origem, 'texto', 'hook', transcricao_hook, tags, favorito, created_at
from hooks;

drop table if exists shots;
drop table if exists hooks;

notify pgrst, 'reload schema';
