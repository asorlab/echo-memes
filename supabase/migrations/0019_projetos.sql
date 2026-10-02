-- ECHO // ASSETS — Projetos MVP (29/09).
-- "projetos": container minimo (nome, tipo de conteudo, status, observacoes,
-- data prevista). "projeto_itens" e a unica tabela de relacionamento —
-- NUNCA guarda o asset em si, so uma referencia polimorfica
-- (tabela_origem + item_id) pro registro que ja existe em memes/audios/
-- visuais/fontes/brand_assets/paletas/edicoes_referencia/inspiracoes.
-- "papel" e o que diferencia Referencia / Planejado / Usado — mover um
-- asset de Planejado pra Usado e so um UPDATE nessa coluna na MESMA linha
-- (nunca cria linha nova nem duplica arquivo), por isso o unique conjunto
-- em (projeto_id, tabela_origem, item_id).
-- Migracao so aditiva/nova, nao mexe em nenhuma tabela existente.
-- Roda inteiro no SQL Editor.

create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  nome text not null default 'Novo projeto',
  tipo_conteudo text check (tipo_conteudo in ('vlog', 'grwm', 'gaming', 'asmr', 'cover', 'lifestyle', 'outro')),
  status text not null default 'planejamento' check (status in ('planejamento', 'em_andamento', 'concluido', 'arquivado')),
  observacoes text,
  data_prevista date,
  excluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table projetos enable row level security;
drop policy if exists "dono ve so os proprios projetos" on projetos;
create policy "dono ve so os proprios projetos" on projetos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists projeto_itens (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  papel text not null check (papel in ('referencia', 'planejado', 'usado')),
  tabela_origem text not null,
  item_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (projeto_id, tabela_origem, item_id)
);
create index if not exists projeto_itens_projeto_papel_idx on projeto_itens (projeto_id, papel);

alter table projeto_itens enable row level security;
drop policy if exists "dono ve so os proprios itens de projeto" on projeto_itens;
create policy "dono ve so os proprios itens de projeto" on projeto_itens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
