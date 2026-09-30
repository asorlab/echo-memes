-- ECHO // ASSETS — modelo novo de importação: fonte persistente + itens
-- individuais + historico de sincronizacoes. Substitui o antigo modelo de
-- "um job = uma importacao pontual" (meme_import_queue), que fica intacto
-- (nao apagado, nao migrado — so 1 linha historica nele, sem valor real
-- pra migrar) e simplesmente para de ser usado por telas novas.
--
-- Agnostico de plataforma de proposito: "platform" e so texto, sem check
-- constraint travando os valores — adicionar Instagram/YouTube/etc no
-- futuro nao exige alterar o schema, so passar um platform novo.
--
-- Nao apaga nem recria nenhum meme existente (memes.plataforma/external_id
-- ja existem, reaproveitados aqui pra dedup/vinculo).
-- Migracao so aditiva, idempotente (create table if not exists).
-- Roda inteiro no SQL Editor.

-- ============================================================
-- FONTES (contas/perfis acompanhados)
-- ============================================================
create table if not exists import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  platform text not null,
  username text not null,
  profile_url text not null,
  total_imported int not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, username)
);

alter table import_sources enable row level security;
drop policy if exists "dono ve so as proprias fontes" on import_sources;
create policy "dono ve so as proprias fontes" on import_sources for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- EXECUÇÕES DE SINCRONIZAÇÃO (histórico de "Sincronizar agora")
-- ============================================================
create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references import_sources on delete cascade not null,
  user_id uuid references auth.users not null,
  status text not null default 'pending', -- pending | discovering | processing | completed | failed | cancelled
  total_found int not null default 0,
  total_new int not null default 0,
  total_downloaded int not null default 0,
  total_skipped int not null default 0,
  total_failed int not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table import_runs enable row level security;
drop policy if exists "dono ve so as proprias execucoes" on import_runs;
create policy "dono ve so as proprias execucoes" on import_runs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists import_runs_source_id_created_at_idx on import_runs (source_id, created_at desc);
create index if not exists import_runs_status_idx on import_runs (status) where status in ('pending', 'discovering', 'processing');

-- ============================================================
-- ITENS INDIVIDUAIS (cada video/conteudo descoberto de uma fonte)
-- ============================================================
create table if not exists import_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references import_sources on delete cascade not null,
  user_id uuid references auth.users not null,
  platform text not null,
  external_id text not null,
  original_url text,
  author text,
  published_at timestamptz,
  caption text,
  status text not null default 'pending', -- pending | downloading | completed | failed | skipped
  error_message text,
  error_category text,
  attempts int not null default 0,
  meme_id uuid references memes on delete set null,
  discovered_in_run_id uuid references import_runs on delete set null,
  processed_in_run_id uuid references import_runs on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

alter table import_items enable row level security;
drop policy if exists "dono ve so os proprios itens" on import_items;
create policy "dono ve so os proprios itens" on import_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists import_items_source_id_status_idx on import_items (source_id, status);

notify pgrst, 'reload schema';
