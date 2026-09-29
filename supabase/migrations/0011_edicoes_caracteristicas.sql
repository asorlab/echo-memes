-- ECHO // ASSETS — Edits ganha: caracteristicas do que chamou atenção
-- (multipla selecao), status (quero testar/testado) e formatos de
-- conteudo onde essa referencia se aplica.
-- Roda inteiro no SQL Editor.

alter table edicoes_referencia add column if not exists caracteristicas text[] not null default '{}';
alter table edicoes_referencia add column if not exists status text check (status in ('quero_testar', 'testado'));
alter table edicoes_referencia add column if not exists formato_conteudo text[] not null default '{}';

notify pgrst, 'reload schema';
