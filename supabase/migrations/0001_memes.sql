-- ECHO // MEMES — tabela unica do acervo de memes. Roda inteiro no SQL Editor.
-- Mesmo projeto Supabase do resto do ECHO (RLS isola por usuario, sem precisar
-- de banco novo).

create table if not exists memes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo meme',
  imagem_url text,
  link_origem text,
  explicacao text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz default now()
);

alter table memes enable row level security;
create policy "dono ve so os proprios dados" on memes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
