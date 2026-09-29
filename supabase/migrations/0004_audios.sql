-- ECHO // ASSETS — biblioteca de Audios/Musicas (trilhas, nao efeitos
-- curtos): licenciamento, clima, BPM — campos que SFX e Memes nao tem.
-- Roda inteiro no SQL Editor.

create table if not exists audios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo áudio',
  arquivo_url text,
  artista text,
  licenciamento text check (licenciamento in ('licenciado', 'nao_licenciado', 'desconhecido')),
  clima text check (clima in ('upbeat', 'calmo', 'tenso', 'emotivo', 'epico', 'engracado', 'misterioso', 'romantico')),
  bpm numeric,
  momento text check (momento in ('gancho', 'transicao', 'punchline', 'fecho')),
  risco text check (risco in ('baixo', 'medio', 'alto')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  link_origem text,
  favorito boolean not null default false,
  created_at timestamptz default now()
);

alter table audios enable row level security;
create policy "dono ve so os proprios dados" on audios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists audios_usos (
  id uuid primary key default gen_random_uuid(),
  audio_id uuid references audios(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  contexto text not null,
  data date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists audios_usos_audio_idx on audios_usos (audio_id);

alter table audios_usos enable row level security;
create policy "dono ve so os proprios usos" on audios_usos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
