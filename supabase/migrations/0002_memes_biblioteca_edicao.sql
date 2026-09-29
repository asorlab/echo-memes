-- ECHO // MEMES — transforma o acervo numa biblioteca de assets pensada pro
-- momento da edicao: classificacao por emocao/momento/formato/forma de uso,
-- risco de direito autoral, metadados tecnicos, corte in/out, favoritos,
-- status e registro de uso por conteudo.
-- Roda inteiro no SQL Editor.

alter table memes add column if not exists emocao text
  check (emocao in ('vergonha', 'choque', 'deboche', 'deu_ruim', 'vitoria', 'cansaco', 'ironia'));
alter table memes add column if not exists momento text
  check (momento in ('gancho', 'transicao', 'punchline', 'fecho'));
alter table memes add column if not exists formatos text[] not null default '{}';
alter table memes add column if not exists forma_uso text[] not null default '{}';
alter table memes add column if not exists audio_pref text
  check (audio_pref in ('original', 'mudo', 'so_fala'));
alter table memes add column if not exists ideia_uso text;
alter table memes add column if not exists intensidade text
  check (intensidade in ('sutil', 'media', 'caos'));
alter table memes add column if not exists favorito boolean not null default false;
alter table memes add column if not exists status text not null default 'novo'
  check (status in ('novo', 'classificado', 'usado'));
alter table memes add column if not exists risco text
  check (risco in ('baixo', 'medio', 'alto'));

alter table memes add column if not exists duracao_seg numeric;
alter table memes add column if not exists orientacao text check (orientacao in ('vertical', 'horizontal'));
alter table memes add column if not exists tem_audio boolean;
alter table memes add column if not exists tem_fala boolean;

alter table memes add column if not exists corte_inicio numeric;
alter table memes add column if not exists corte_fim numeric;

create table if not exists memes_usos (
  id uuid primary key default gen_random_uuid(),
  meme_id uuid references memes(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  contexto text not null,
  data date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists memes_usos_meme_idx on memes_usos (meme_id);

alter table memes_usos enable row level security;
create policy "dono ve so os proprios usos" on memes_usos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
