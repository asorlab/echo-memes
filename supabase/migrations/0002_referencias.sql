-- ECHO // MEMES — evolui a tabela `memes` pra biblioteca de referências
-- (plataforma, criador, categoria, data de publicação), sem recriar nada
-- nem apagar dados existentes. Roda inteiro no SQL Editor.

alter table memes add column if not exists plataforma text;
alter table memes add column if not exists criador text;
alter table memes add column if not exists categoria text check (categoria in ('iveasor','asor','aivil','geral') or categoria is null);
alter table memes add column if not exists publicado_em timestamptz;

notify pgrst, 'reload schema';
