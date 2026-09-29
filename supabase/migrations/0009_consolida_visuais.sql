-- ECHO // ASSETS — consolida Overlays, Transicoes e Presets numa unica
-- biblioteca "Visuais" (campo "tipo": overlay, transicao, textura,
-- png_elemento, preset_lut). Preserva os dados existentes migrando pra
-- visuais/visuais_usos, depois remove as tabelas antigas.
-- Roda inteiro no SQL Editor.

create table if not exists visuais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  titulo text not null default 'Novo visual',
  arquivo_url text,
  link_origem text,
  tipo text check (tipo in ('overlay', 'transicao', 'textura', 'png_elemento', 'preset_lut')),
  transparente boolean,
  app_compativel text check (app_compativel in ('capcut', 'premiere', 'davinci', 'lut_generico', 'outro')),
  estilo text check (estilo in ('cinematic', 'vibrante', 'preto_e_branco', 'vintage', 'cru', 'outro')),
  momento text check (momento in ('gancho', 'transicao', 'punchline', 'fecho')),
  duracao_seg numeric,
  tags text[] not null default '{}',
  favorito boolean not null default false,
  created_at timestamptz default now()
);
alter table visuais enable row level security;
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
create policy "dono ve so os proprios usos" on visuais_usos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- migra overlays
alter table visuais add column if not exists overlay_id_antigo uuid;
alter table visuais add column if not exists transicao_id_antigo uuid;
alter table visuais add column if not exists preset_id_antigo uuid;

insert into visuais (user_id, titulo, arquivo_url, tipo, transparente, momento, duracao_seg, tags, link_origem, favorito, created_at, overlay_id_antigo)
select user_id, titulo, arquivo_url, 'overlay', transparente, momento, duracao_seg, tags, link_origem, favorito, created_at, id
from overlays;

insert into visuais (user_id, titulo, arquivo_url, tipo, duracao_seg, tags, link_origem, favorito, created_at, transicao_id_antigo)
select user_id, titulo, arquivo_url, 'transicao', duracao_seg, tags, link_origem, favorito, created_at, id
from transicoes;

insert into visuais (user_id, titulo, arquivo_url, tipo, app_compativel, estilo, tags, link_origem, favorito, created_at, preset_id_antigo)
select user_id, titulo, arquivo_url, 'preset_lut', app_compativel, estilo, tags, link_origem, favorito, created_at, id
from presets;

insert into visuais_usos (visual_id, user_id, contexto, data, created_at)
select v.id, ou.user_id, ou.contexto, ou.data, ou.created_at from overlays_usos ou join visuais v on v.overlay_id_antigo = ou.overlay_id;
insert into visuais_usos (visual_id, user_id, contexto, data, created_at)
select v.id, tu.user_id, tu.contexto, tu.data, tu.created_at from transicoes_usos tu join visuais v on v.transicao_id_antigo = tu.transicao_id;
insert into visuais_usos (visual_id, user_id, contexto, data, created_at)
select v.id, pu.user_id, pu.contexto, pu.data, pu.created_at from presets_usos pu join visuais v on v.preset_id_antigo = pu.preset_id;

alter table visuais drop column overlay_id_antigo;
alter table visuais drop column transicao_id_antigo;
alter table visuais drop column preset_id_antigo;

drop table if exists overlays_usos;
drop table if exists overlays;
drop table if exists transicoes_usos;
drop table if exists transicoes;
drop table if exists presets_usos;
drop table if exists presets;

notify pgrst, 'reload schema';
