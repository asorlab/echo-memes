-- ECHO // ASSETS — cache de secUid + categoria de erro nas execucoes
-- (fallback de discovery de perfil via Playwright, 30/09).
--
-- "sec_uid": cache do identificador interno do TikTok pra essa Fonte,
-- obtido via fallback (Playwright) na primeira vez que o discovery direto
-- (@usuario) falhar. Sincronizacoes seguintes tentam esse valor primeiro,
-- sem precisar abrir navegador de novo. Continua null pra fontes onde o
-- metodo direto ja funciona.
-- "error_category" em import_runs: classifica falha de EXECUCAO (nao de
-- item individual, que ja tem sua propria coluna) — private_account,
-- profile_discovery_failed ou secuid_resolution_failed.
--
-- Migracao so aditiva, idempotente, nao mexe em nenhum dado existente.
-- Roda inteiro no SQL Editor.

alter table import_sources add column if not exists sec_uid text;
alter table import_runs add column if not exists error_category text
  check (error_category in ('private_account', 'profile_discovery_failed', 'secuid_resolution_failed') or error_category is null);

notify pgrst, 'reload schema';
