-- ECHO — audit log (Fase 4 da auditoria, item #5-8).
-- Tabela de eventos de seguranca, escrita so pelo servidor (triggers +
-- funcao security definer) — o cliente nunca insere/altera/apaga direto.
-- Projeto Supabase compartilhado entre echo-memes e echo-os-app, entao
-- essa migracao so precisa rodar UMA VEZ (serve os dois apps).
-- Roda inteiro no SQL Editor.

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

-- So SELECT pro dono. Sem policy de insert/update/delete pro usuario comum
-- de proposito — isso fecha a porta pro frontend escrever/alterar/apagar
-- eventos arbitrariamente. Quem grava e sempre codigo do servidor: os
-- triggers abaixo (security definer, sempre usam o user_id real da linha
-- que mudou) ou a funcao registrar_evento_auditoria (security definer,
-- sempre usa auth.uid() — o proprio usuario logado, nunca um parametro que
-- o cliente possa forjar pra outro user_id).
create policy "dono ve so os proprios eventos" on audit_log for select
  using (auth.uid() = user_id);

-- Funcao generica pra eventos que nao correspondem a um INSERT/UPDATE/
-- DELETE direto numa tabela (ex.: ativar/desativar MFA, que mexe no schema
-- auth do Supabase, nao em tabela nossa). auth.uid() vem da sessao
-- validada no servidor — o cliente autenticado pode chamar, mas so grava
-- eventos em nome de si mesmo, nunca de outro user_id.
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

-- Trigger generico pros 9 tabelas de asset do ECHO // ASSETS: loga sozinho,
-- direto da mudanca real na linha — nao depende do frontend lembrar de
-- chamar nada, entao nao da pra "esquecer" ou forjar sem de fato excluir/
-- restaurar/apagar o registro. Nunca deixa uma falha no log quebrar a
-- operacao real (bloco exception).
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
    -- log nunca pode derrubar a operacao real
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
    execute format('drop trigger if exists trg_auditoria_asset on %I', t);
    execute format('create trigger trg_auditoria_asset after update or delete on %I for each row execute function _log_auditoria_asset()', t);
  end loop;
end $$;

-- Upload: loga direto do storage.objects (fonte real do evento — nao da pra
-- fingir um upload sem de fato subir o arquivo). Extrai o user_id do
-- primeiro segmento do caminho ({user_id}/pasta/arquivo); qualquer erro
-- inesperado e engolido pra nunca quebrar o upload de verdade.
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
