-- ECHO // ASSETS: sessoes de gravacao e fila do worker local (Fase 2 do Creator OS).
--
-- Original fica no PC; a nuvem guarda metadados, miniaturas e um proxy leve.
-- 1) producao_sessoes: uma gravacao (live, gameplay, vlog, 3D...) com seus brutos.
-- 2) producao_brutos ganha: sessao, caminho no PC, hash (duplicata), proxy, miniaturas, metadados.
-- 3) producao_jobs ganha retentativa com espera crescente, heartbeat e payload; aceita o tipo "ingest".
-- 4) producao_job_logs e producao_worker_status: o que o worker fez e se ele esta ligado.
-- 5) Funcoes da fila: so o servidor (service role) chama. O navegador nao reivindica job.
--
-- So acrescenta. Nao apaga nem altera dado nenhum. Roda inteiro no SQL Editor (sem selecionar trecho).

-- 1) Sessoes
create table if not exists producao_sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  data date not null default current_date,
  tipo text not null default 'outro' check (tipo in ('live', 'gameplay', 'vlog', 'asor_3d', 'bastidor', 'outro')),
  plataforma text,
  marca_slug text check (marca_slug in ('iveasor', 'asor_lab')),
  notas text,
  pasta_local text, -- subpasta da pasta vigiada que originou a sessao (para agrupar os brutos)
  excluido_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists producao_sessoes_user_idx on producao_sessoes (user_id, data desc);
alter table producao_sessoes enable row level security;
drop policy if exists "producao_sessoes_owner" on producao_sessoes;
create policy "producao_sessoes_owner" on producao_sessoes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Brutos
alter table producao_brutos add column if not exists sessao_id uuid references producao_sessoes(id) on delete set null;
alter table producao_brutos add column if not exists caminho_local text;
alter table producao_brutos add column if not exists hash_arquivo text;
alter table producao_brutos add column if not exists proxy_url text;      -- caminho no bucket producao-raw
alter table producao_brutos add column if not exists miniatura_url text;  -- caminho no bucket life-os
alter table producao_brutos add column if not exists sprite_url text;     -- tira de miniaturas, bucket life-os
alter table producao_brutos add column if not exists metadados jsonb;
create index if not exists producao_brutos_hash_idx on producao_brutos (user_id, hash_arquivo) where hash_arquivo is not null;
create index if not exists producao_brutos_sessao_idx on producao_brutos (sessao_id);

drop policy if exists "producao_brutos_owner" on producao_brutos;
create policy "producao_brutos_owner" on producao_brutos for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (sessao_id is null or exists (select 1 from producao_sessoes s where s.id = producao_brutos.sessao_id and s.user_id = auth.uid()))
  );

-- 3) Fila
alter table producao_jobs add column if not exists tentativas int not null default 0;
alter table producao_jobs add column if not exists max_tentativas int not null default 3;
alter table producao_jobs add column if not exists proximo_em timestamptz not null default now();
alter table producao_jobs add column if not exists worker_id text;
alter table producao_jobs add column if not exists heartbeat_em timestamptz;
alter table producao_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table producao_jobs add column if not exists resultado jsonb;
alter table producao_jobs drop constraint if exists producao_jobs_tipo_check;
alter table producao_jobs add constraint producao_jobs_tipo_check check (tipo in (
  'ingest', 'transcribe', 'analyze', 'detect_moments', 'render_clip', 'render_long', 'captions', 'normalize_audio', 'tracking', 'export'));
create index if not exists producao_jobs_fila_idx on producao_jobs (status, proximo_em) where status in ('queued', 'processing');

-- 4) Logs e estado do worker
create table if not exists producao_job_logs (
  id bigint generated always as identity primary key,
  job_id uuid not null references producao_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nivel text not null default 'info' check (nivel in ('info', 'aviso', 'erro')),
  mensagem text not null,
  created_at timestamptz not null default now()
);
create index if not exists producao_job_logs_job_idx on producao_job_logs (job_id, created_at);
alter table producao_job_logs enable row level security;
drop policy if exists "producao_job_logs_leitura" on producao_job_logs;
create policy "producao_job_logs_leitura" on producao_job_logs for select using (auth.uid() = user_id);

create table if not exists producao_worker_status (
  worker_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  visto_em timestamptz not null default now(),
  pasta text,
  versao text,
  detalhe jsonb
);
alter table producao_worker_status enable row level security;
drop policy if exists "producao_worker_status_leitura" on producao_worker_status;
create policy "producao_worker_status_leitura" on producao_worker_status for select using (auth.uid() = user_id);

-- 5) Funcoes da fila (service role)
create or replace function reivindicar_job(p_tipos text[], p_worker text)
returns setof producao_jobs
language plpgsql
set search_path = public
as $$
declare v producao_jobs;
begin
  -- Job sem sinal de vida ha 15 min: volta para a fila (ou falha, se acabaram as tentativas).
  update producao_jobs
     set status = case when tentativas >= max_tentativas then 'failed' else 'queued' end,
         erro_mensagem = coalesce(erro_mensagem, 'O worker parou no meio; o job voltou para a fila.'),
         finished_at = case when tentativas >= max_tentativas then now() else null end,
         worker_id = null, proximo_em = now()
   where status = 'processing' and coalesce(heartbeat_em, started_at, created_at) < now() - interval '15 minutes';

  -- Pega o mais antigo pronto para rodar; skip locked evita dois workers no mesmo job.
  select * into v from producao_jobs
   where status = 'queued' and tipo = any(p_tipos) and proximo_em <= now()
   order by created_at
   for update skip locked
   limit 1;
  if not found then return; end if;

  update producao_jobs
     set status = 'processing', worker_id = p_worker, started_at = now(), heartbeat_em = now(),
         tentativas = tentativas + 1, erro_mensagem = null
   where id = v.id
  returning * into v;
  return next v;
end $$;

create or replace function heartbeat_job(p_id uuid, p_progresso int default null)
returns void language sql set search_path = public as $$
  update producao_jobs set heartbeat_em = now(), progresso = coalesce(least(greatest(p_progresso, 0), 100), progresso)
   where id = p_id and status = 'processing';
$$;

create or replace function concluir_job(p_id uuid, p_resultado jsonb default null)
returns void language sql set search_path = public as $$
  update producao_jobs set status = 'completed', progresso = 100, resultado = p_resultado, finished_at = now(), heartbeat_em = now(), erro_mensagem = null
   where id = p_id;
$$;

-- Falhou: tenta de novo em 1, 5 e 30 minutos; depois de max_tentativas fica 'failed' com a mensagem.
create or replace function falhar_job(p_id uuid, p_erro text)
returns void language sql set search_path = public as $$
  update producao_jobs
     set status = case when tentativas >= max_tentativas then 'failed' else 'queued' end,
         erro_mensagem = left(p_erro, 500),
         worker_id = null,
         proximo_em = now() + case tentativas when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '30 minutes' end,
         finished_at = case when tentativas >= max_tentativas then now() else null end
   where id = p_id;
$$;

revoke all on function reivindicar_job(text[], text) from public, anon, authenticated;
revoke all on function heartbeat_job(uuid, int) from public, anon, authenticated;
revoke all on function concluir_job(uuid, jsonb) from public, anon, authenticated;
revoke all on function falhar_job(uuid, text) from public, anon, authenticated;
grant execute on function reivindicar_job(text[], text) to service_role;
grant execute on function heartbeat_job(uuid, int) to service_role;
grant execute on function concluir_job(uuid, jsonb) to service_role;
grant execute on function falhar_job(uuid, text) to service_role;

notify pgrst, 'reload schema';

select 'producao_sessoes' as item, count(*)::text as ok from information_schema.tables where table_name = 'producao_sessoes'
union all select 'producao_job_logs', count(*)::text from information_schema.tables where table_name = 'producao_job_logs'
union all select 'producao_worker_status', count(*)::text from information_schema.tables where table_name = 'producao_worker_status'
union all select 'colunas novas em producao_brutos', count(*)::text from information_schema.columns where table_name = 'producao_brutos' and column_name in ('sessao_id','caminho_local','hash_arquivo','proxy_url','miniatura_url','sprite_url','metadados')
union all select 'colunas novas em producao_jobs', count(*)::text from information_schema.columns where table_name = 'producao_jobs' and column_name in ('tentativas','max_tentativas','proximo_em','worker_id','heartbeat_em','payload','resultado')
union all select 'funcoes da fila', count(*)::text from pg_proc where proname in ('reivindicar_job','heartbeat_job','concluir_job','falhar_job');
