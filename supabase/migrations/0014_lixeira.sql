-- ECHO // ASSETS — lixeira (Fase 3 da auditoria, item #2).
-- Excluir passa a ser reversivel: marca excluido_em em vez de apagar a
-- linha na hora. So a exclusao DEFINITIVA (feita a partir da lixeira)
-- remove o registro — e so depois de remover o arquivo do Storage, quando
-- ele existe (ver src/lib/lixeira.ts).
-- Migracao so aditiva (colunas novas, default null) — nao mexe em dado
-- existente, nada e apagado ou migrado.
-- Roda inteiro no SQL Editor.

alter table memes add column if not exists excluido_em timestamptz;
alter table audios add column if not exists excluido_em timestamptz;
alter table visuais add column if not exists excluido_em timestamptz;
alter table templates add column if not exists excluido_em timestamptz;
alter table fontes add column if not exists excluido_em timestamptz;
alter table brand_assets add column if not exists excluido_em timestamptz;
alter table paletas add column if not exists excluido_em timestamptz;
alter table inspiracoes add column if not exists excluido_em timestamptz;
alter table edicoes_referencia add column if not exists excluido_em timestamptz;

notify pgrst, 'reload schema';
