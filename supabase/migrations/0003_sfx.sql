-- ECHO // ASSETS — biblioteca de SFX (efeitos sonoros curtos), separada de
-- memes com campos proprios: categoria de efeito, sem classificacao de
-- emocao/formato de video que nao fazem sentido pra audio.
-- Roda inteiro no SQL Editor.

create table if not exists sfx (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo SFX',
  arquivo_url text,
  categoria text check (categoria in ('whoosh', 'impacto', 'notificacao', 'transicao', 'risada', 'erro', 'sucesso', 'ambiente', 'outro')),
  momento text check (momento in ('gancho', 'transicao', 'punchline', 'fecho')),
  risco text check (risco in ('baixo', 'medio', 'alto')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  link_origem text,
  favorito boolean not null default false,
  created_at timestamptz default now()
);

alter table sfx enable row level security;
create policy "dono ve so os proprios dados" on sfx for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists sfx_usos (
  id uuid primary key default gen_random_uuid(),
  sfx_id uuid references sfx(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  contexto text not null,
  data date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists sfx_usos_sfx_idx on sfx_usos (sfx_id);

alter table sfx_usos enable row level security;
create policy "dono ve so os proprios usos" on sfx_usos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
