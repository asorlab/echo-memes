-- ECHO // ASSETS — lixeira (Fase 3 da auditoria, item #2).
-- Excluir passa a ser reversivel: marca excluido_em em vez de apagar a
-- linha na hora. So a exclusao DEFINITIVA (feita a partir da lixeira)
-- remove o registro — e so depois de remover o arquivo do Storage, quando
-- ele existe (ver src/lib/lixeira.ts).
-- Migracao so aditiva (colunas novas, default null) — nao mexe em dado
-- existente, nada e apagado ou migrado.
-- Roda inteiro no SQL Editor.

-- to_regclass checa se a tabela existe antes de alterar — se alguma nao
-- existir de verdade no banco (aconteceu com "visuais"/"templates"), pula
-- ela com um aviso em vez de abortar a migracao inteira.
do $$
declare
  t text;
begin
  foreach t in array array['memes','audios','visuais','templates','fontes','brand_assets','paletas','inspiracoes','edicoes_referencia']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table %I add column if not exists excluido_em timestamptz', t);
    else
      raise notice 'tabela % nao existe — coluna excluido_em NAO adicionada pra ela', t;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
