-- ECHO // ASSETS — quantidade de importacao por execucao (30/09).
-- "limite_selecionado": quantos videos (dos "novos"/ainda nao conhecidos
-- descobertos nessa execucao) devem realmente virar import_items. null =
-- sem limite ("Todos"/comportamento padrao de "Sincronizar agora" nas
-- sincronizacoes seguintes). Definido por execucao (nao por fonte), porque
-- o mesmo valor digitado na tela muda a cada acao ("importar 50", depois
-- "importar mais 200 antigos", etc.).
-- "total_selected": quantos de fato foram selecionados (min(limite,
-- quantidade de novos encontrados)) — pra distinguir Encontrados vs
-- Selecionados vs Importados vs Falharam na interface.
--
-- Migracao so aditiva, idempotente, nao mexe em nenhum dado existente.
-- Roda inteiro no SQL Editor.

alter table import_runs add column if not exists limite_selecionado int;
alter table import_runs add column if not exists total_selected int not null default 0;

notify pgrst, 'reload schema';
