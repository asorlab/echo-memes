-- ECHO // ASSETS — resto do grupo EDICAO: Overlays, Transicoes, Presets,
-- Templates. Cada um com campos proprios (nao reaproveita os de memes/sfx).
-- Roda inteiro no SQL Editor.

create table if not exists overlays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo overlay',
  arquivo_url text,
  tipo text check (tipo in ('chuva', 'grao', 'glitch', 'luz', 'poeira', 'fumaca', 'vhs', 'outro')),
  transparente boolean not null default false,
  momento text check (momento in ('gancho', 'transicao', 'punchline', 'fecho')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  link_origem text,
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table overlays enable row level security;
create policy "dono ve so os proprios dados" on overlays for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists overlays_usos (
  id uuid primary key default gen_random_uuid(), overlay_id uuid references overlays(id) on delete cascade not null,
  user_id uuid references auth.users not null, contexto text not null, data date not null default current_date, created_at timestamptz default now()
);
create index if not exists overlays_usos_idx on overlays_usos (overlay_id);
alter table overlays_usos enable row level security;
create policy "dono ve so os proprios usos" on overlays_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists transicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Nova transição',
  arquivo_url text,
  tipo text check (tipo in ('corte_seco', 'fade', 'whip_pan', 'zoom', 'glitch', 'luma', 'slide', 'outro')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  link_origem text,
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table transicoes enable row level security;
create policy "dono ve so os proprios dados" on transicoes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists transicoes_usos (
  id uuid primary key default gen_random_uuid(), transicao_id uuid references transicoes(id) on delete cascade not null,
  user_id uuid references auth.users not null, contexto text not null, data date not null default current_date, created_at timestamptz default now()
);
create index if not exists transicoes_usos_idx on transicoes_usos (transicao_id);
alter table transicoes_usos enable row level security;
create policy "dono ve so os proprios usos" on transicoes_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo preset',
  arquivo_url text,
  app_compativel text check (app_compativel in ('capcut', 'premiere', 'davinci', 'lut_generico', 'outro')),
  estilo text check (estilo in ('cinematic', 'vibrante', 'preto_e_branco', 'vintage', 'cru', 'outro')),
  tags text[] not null default '{}',
  link_origem text,
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table presets enable row level security;
create policy "dono ve so os proprios dados" on presets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists presets_usos (
  id uuid primary key default gen_random_uuid(), preset_id uuid references presets(id) on delete cascade not null,
  user_id uuid references auth.users not null, contexto text not null, data date not null default current_date, created_at timestamptz default now()
);
create index if not exists presets_usos_idx on presets_usos (preset_id);
alter table presets_usos enable row level security;
create policy "dono ve so os proprios usos" on presets_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo template',
  arquivo_url text,
  link_origem text,
  app_compativel text check (app_compativel in ('capcut', 'premiere', 'davinci', 'outro')),
  orientacao text check (orientacao in ('vertical', 'horizontal')),
  ideia_uso text,
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table templates enable row level security;
create policy "dono ve so os proprios dados" on templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create table if not exists templates_usos (
  id uuid primary key default gen_random_uuid(), template_id uuid references templates(id) on delete cascade not null,
  user_id uuid references auth.users not null, contexto text not null, data date not null default current_date, created_at timestamptz default now()
);
create index if not exists templates_usos_idx on templates_usos (template_id);
alter table templates_usos enable row level security;
create policy "dono ve so os proprios usos" on templates_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
