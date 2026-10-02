-- ECHO — funcao pro Security Center (30/09).
-- So devolve contagens + a lista de tabelas SEM RLS (informacao acionavel
-- pro dono, nao um segredo) + se as duas funcoes criticas existem + estado
-- do bucket. Nunca devolve dado de linha nenhuma, nunca segredo. Security
-- definer porque pg_catalog/storage.buckets nao sao expostos via PostgREST
-- normalmente — a funcao le isso internamente em SQL puro e so devolve o
-- resumo.
-- Roda inteiro no SQL Editor.

create or replace function obter_estado_seguranca()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_com_rls int;
  v_sem_rls_nomes text[];
  v_bucket_publico boolean;
begin
  select count(*) into v_total
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  select count(*) into v_com_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true;

  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into v_sem_rls_nomes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;

  select public into v_bucket_publico from storage.buckets where id = 'life-os';

  return jsonb_build_object(
    'tabelas_total', v_total,
    'tabelas_com_rls', v_com_rls,
    'tabelas_sem_rls', v_total - v_com_rls,
    'tabelas_sem_rls_nomes', to_jsonb(v_sem_rls_nomes),
    'funcao_audit_log_existe', to_regprocedure('public.registrar_evento_auditoria(text, text, text, jsonb)') is not null,
    'funcao_rate_limit_existe', to_regprocedure('public.checar_rate_limit(text, int, int)') is not null,
    'bucket_life_os_publico', v_bucket_publico,
    'verificado_em', now()
  );
end;
$$;

grant execute on function obter_estado_seguranca() to authenticated;

notify pgrst, 'reload schema';
