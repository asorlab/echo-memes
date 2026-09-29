-- ECHO // ASSETS — grupo IDENTIDADE: Fontes, Brand Assets, Paletas/Looks.
-- Sao referencia/identidade, nao asset consumido por video especifico —
-- por isso sem tabela de registro de uso, diferente do grupo Edicao.
-- Roda inteiro no SQL Editor.

create table if not exists fontes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Nova fonte',
  arquivo_url text,
  link_origem text,
  estilo text check (estilo in ('serifada', 'sem_serifa', 'script', 'display', 'monoespacada')),
  uso_ideal text check (uso_ideal in ('titulo', 'legenda', 'corpo_texto')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table fontes enable row level security;
create policy "dono ve so os proprios dados" on fontes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo brand asset',
  arquivo_url text,
  tipo text check (tipo in ('logo', 'marca_dagua', 'assinatura', 'icone', 'outro')),
  cor text check (cor in ('colorido', 'branco', 'preto', 'outro')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table brand_assets enable row level security;
create policy "dono ve so os proprios dados" on brand_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists paletas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Nova paleta',
  arquivo_url text,
  link_origem text,
  cores text[] not null default '{}',
  estilo text check (estilo in ('upbeat', 'calmo', 'tenso', 'emotivo', 'epico', 'engracado', 'misterioso', 'romantico')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table paletas enable row level security;
create policy "dono ve so os proprios dados" on paletas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
