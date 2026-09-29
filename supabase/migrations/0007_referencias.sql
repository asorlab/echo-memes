-- ECHO // ASSETS — grupo REFERENCIAS: Edicoes (com timestamps de trecho
-- util), Shots, Hooks, Inspiracoes. Sem registro de uso, sao material de
-- estudo/referencia, nao asset que entra direto no video.
-- Roda inteiro no SQL Editor.

create table if not exists edicoes_referencia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Nova edição de referência',
  arquivo_url text,
  link_origem text,
  plataforma text,
  criador text,
  ideia_uso text,
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table edicoes_referencia enable row level security;
create policy "dono ve so os proprios dados" on edicoes_referencia for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists edicoes_timestamps (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid references edicoes_referencia(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  inicio_seg numeric not null,
  fim_seg numeric,
  nota text not null default '',
  created_at timestamptz default now()
);
create index if not exists edicoes_timestamps_edicao_idx on edicoes_timestamps (edicao_id);
alter table edicoes_timestamps enable row level security;
create policy "dono ve so os proprios dados" on edicoes_timestamps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo shot',
  arquivo_url text,
  link_origem text,
  tipo_shot text check (tipo_shot in ('close_up', 'plano_medio', 'plano_geral', 'over_the_shoulder', 'pov', 'drone', 'outro')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table shots enable row level security;
create policy "dono ve so os proprios dados" on shots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists hooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo hook',
  link_origem text,
  transcricao_hook text,
  tipo text check (tipo in ('pergunta', 'afirmacao_chocante', 'estatistica', 'historia', 'outro')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table hooks enable row level security;
create policy "dono ve so os proprios dados" on hooks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists inspiracoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Nova inspiração',
  arquivo_url text,
  link_origem text,
  categoria text check (categoria in ('video', 'imagem', 'texto', 'conta_perfil', 'outro')),
  nota text,
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table inspiracoes enable row level security;
create policy "dono ve so os proprios dados" on inspiracoes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
