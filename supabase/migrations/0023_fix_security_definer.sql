-- ECHO — corrige divergencia critica encontrada na auditoria de 30/09:
-- registrar_evento_auditoria e checar_rate_limit (das migrations 0013 e
-- 0015) nunca existiram de verdade no banco, apesar dos arquivos existirem
-- no repo — confirmado com admin key, multiplas assinaturas, sem cache
-- de PostgREST envolvido. Esta migration recria as duas por completo
-- (idempotente, tudo "create table if not exists"/"create or replace
-- function") e ENDURECE checar_rate_limit: antes, p_chave era 100%
-- controlada pelo cliente sem nenhum vinculo com quem chamou — um usuario
-- autenticado podia esgotar o rate limit de OUTRO usuario so sabendo o
-- UUID dele. Agora, toda chamada feita por uma sessao de usuario real
-- (auth.uid() preenchido — o caso dos dois storage.ts, chamados direto do
-- navegador) so aceita chave que contenha o proprio uid como segmento
-- delimitado por ":". Chamada pelo servidor via service role (apiGuard.ts
-- — auth.uid() sempre null nesse contexto) continua sem essa restricao,
-- porque quem decide a chave ali e codigo nosso, nao o usuario.
-- Roda inteiro no SQL Editor.

-- ============================================================
-- RATE LIMITING
-- ============================================================
create table if not exists api_rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contagem int not null default 0
);
alter table api_rate_limits enable row level security;

create or replace function checar_rate_limit(p_chave text, p_limite int, p_janela_seg int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem int;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is not null and p_chave !~ ('(^|:)' || v_uid::text || '(:|$)') then
    raise exception 'chave de rate limit nao pertence ao usuario autenticado';
  end if;

  insert into api_rate_limits (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem = case
      when api_rate_limits.janela_inicio < now() - (p_janela_seg || ' seconds')::interval
        then 1
      else api_rate_limits.contagem + 1
    end,
    janela_inicio = case
      when api_rate_limits.janela_inicio < now() - (p_janela_seg || ' seconds')::interval
        then now()
      else api_rate_limits.janela_inicio
    end
  returning contagem into v_contagem;

  return v_contagem <= p_limite;
end;
$$;

grant execute on function checar_rate_limit(text, int, int) to authenticated;

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  evento text not null,
  resource_type text,
  resource_id text,
  criado_em timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_user_id_criado_em_idx on audit_log (user_id, criado_em desc);
alter table audit_log enable row level security;
drop policy if exists "dono ve so os proprios eventos" on audit_log;
create policy "dono ve so os proprios eventos" on audit_log for select
  using (auth.uid() = user_id);

create or replace function registrar_evento_auditoria(p_evento text, p_resource_type text default null, p_resource_id text default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (user_id, evento, resource_type, resource_id, metadata)
  values (auth.uid(), p_evento, p_resource_type, p_resource_id, p_metadata);
end;
$$;

grant execute on function registrar_evento_auditoria(text, text, text, jsonb) to authenticated;

create or replace function _log_auditoria_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if TG_OP = 'DELETE' then
      insert into audit_log (user_id, evento, resource_type, resource_id, metadata)
      values (OLD.user_id, 'exclusao_definitiva', TG_TABLE_NAME, OLD.id::text, jsonb_build_object('titulo', OLD.titulo));
      return OLD;
    elsif TG_OP = 'UPDATE' then
      if OLD.excluido_em is null and NEW.excluido_em is not null then
        insert into audit_log (user_id, evento, resource_type, resource_id, metadata)
        values (NEW.user_id, 'enviado_lixeira', TG_TABLE_NAME, NEW.id::text, jsonb_build_object('titulo', NEW.titulo));
      elsif OLD.excluido_em is not null and NEW.excluido_em is null then
        insert into audit_log (user_id, evento, resource_type, resource_id, metadata)
        values (NEW.user_id, 'restaurado', TG_TABLE_NAME, NEW.id::text, jsonb_build_object('titulo', NEW.titulo));
      end if;
      return NEW;
    end if;
  exception when others then
    null;
  end;
  return coalesce(NEW, OLD);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['memes','audios','visuais','templates','fontes','brand_assets','paletas','inspiracoes','edicoes_referencia']
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop trigger if exists trg_auditoria_asset on %I', t);
      execute format('create trigger trg_auditoria_asset after update or delete on %I for each row execute function _log_auditoria_asset()', t);
    else
      raise notice 'tabela % nao existe — trigger de auditoria NAO criado pra ela', t;
    end if;
  end loop;
end $$;

create or replace function _log_auditoria_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  begin
    if NEW.bucket_id = 'life-os' then
      v_user_id := (storage.foldername(NEW.name))[1]::uuid;
      insert into audit_log (user_id, evento, resource_type, resource_id, metadata)
      values (v_user_id, 'upload', 'storage_object', NEW.name, jsonb_build_object('tamanho_bytes', NEW.metadata->>'size'));
    end if;
  exception when others then
    null;
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_auditoria_upload on storage.objects;
create trigger trg_auditoria_upload after insert on storage.objects
  for each row execute function _log_auditoria_upload();

notify pgrst, 'reload schema';
