-- ECHO // ASSETS — estabilizacao MVP (29/09).
-- Duas partes independentes, ambas so aditivas, nenhuma toca em dado
-- existente:
--
-- 1) Cria "visuais"/"visuais_usos" de verdade — migracao 0009 desenhou
--    esse schema mas a tabela nunca existiu no banco (auditoria
--    confirmou). O codigo (src/app/visuais/page.tsx) ja esta pronto e
--    completo esperando por ela. "tipo" ganha mais opcoes (b_roll,
--    green_screen, gif, template) pra virar o lugar generico de todo
--    asset visual sem precisar de tabela separada por tipo.
-- 2) Adiciona memes.arquivo_hash (SHA-256 do arquivo) — Camada 2 de
--    deduplicacao: antes de criar um meme novo, o worker passa a
--    verificar se o hash do arquivo baixado ja existe pra esse usuario;
--    se sim, nao duplica upload/registro, so vincula ao existente.
--
-- Roda inteiro no SQL Editor.

create table if not exists visuais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo visual',
  arquivo_url text,
  link_origem text,
  tipo text check (tipo in ('overlay', 'transicao', 'textura', 'png_elemento', 'preset_lut', 'b_roll', 'green_screen', 'gif', 'template')),
  transparente boolean,
  app_compativel text check (app_compativel in ('capcut', 'premiere', 'davinci', 'lut_generico', 'outro')),
  estilo text check (estilo in ('cinematic', 'vibrante', 'preto_e_branco', 'vintage', 'cru', 'outro')),
  momento text check (momento in ('gancho', 'transicao', 'punchline', 'fecho')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  favorito boolean not null default false,
  excluido_em timestamptz,
  created_at timestamptz default now()
);
alter table visuais enable row level security;
drop policy if exists "dono ve so os proprios dados" on visuais;
create policy "dono ve so os proprios dados" on visuais for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists visuais_usos (
  id uuid primary key default gen_random_uuid(),
  visual_id uuid references visuais(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  contexto text not null,
  data date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists visuais_usos_idx on visuais_usos (visual_id);
alter table visuais_usos enable row level security;
drop policy if exists "dono ve so os proprios usos" on visuais_usos;
create policy "dono ve so os proprios usos" on visuais_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table memes add column if not exists arquivo_hash text;
create index if not exists memes_user_hash_idx on memes (user_id, arquivo_hash);

notify pgrst, 'reload schema';
