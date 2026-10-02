-- ECHO // ASSETS — Production: fundacao do fluxo RAW FOOTAGE -> ... ->
-- ANALYTICS. So estrutura + UI de cadastro/gestao nesta rodada — nenhuma
-- IA/transcricao/render real roda ainda (isso fica pra rodadas futuras,
-- contra as interfaces de provider preparadas aqui).
--
-- Principio central: o ORIGINAL (producao_brutos) nunca e sobrescrito.
-- Tudo que sai dele (transcricao, momentos, cortes, versoes) e sempre um
-- registro NOVO relacionado, nunca uma alteracao do bruto.
--
-- Integra com o Projetos MVP existente (0019_projetos.sql) por RELACAO
-- (producao_projetos.projeto_id, nullable), nunca duplicando —
-- producao_projetos.projeto_id aponta pro "projetos" ja existente, que
-- continua sendo o unico lugar com Referencias/Planejado/Usado
-- (projeto_itens) pra Assets (musica, SFX, fonte, referencia etc.).
-- Nao mexe em "projetos"/"projeto_itens" de forma nenhuma.
--
-- 100% aditivo. Nenhum DROP, nenhuma alteracao em RLS/tabela existente.
-- Roda inteiro no SQL Editor.

-- ============================================================
-- BUCKET PROPRIO PRA RAW FOOTAGE — video bruto de vlog facilmente passa
-- de 50MB (limite atual do bucket "life-os", compartilhado com os dois
-- apps pra asset pequeno). Em vez de subir o limite global (afetaria
-- upload de meme/audio/visual tambem), bucket novo, so pra isso, privado,
-- com limite maior e mime-type restrito a video. Mesmo padrao de policy
-- por pasta-dono do life-os.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('producao-raw', 'producao-raw', false, 524288000, array['video/mp4','video/quicktime','video/webm','video/x-m4v','video/x-matroska'])
on conflict (id) do nothing;

drop policy if exists "dono le seus brutos" on storage.objects;
create policy "dono le seus brutos" on storage.objects for select
  using (bucket_id = 'producao-raw' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "dono envia seus brutos" on storage.objects;
create policy "dono envia seus brutos" on storage.objects for insert
  with check (bucket_id = 'producao-raw' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "dono atualiza seus brutos" on storage.objects;
create policy "dono atualiza seus brutos" on storage.objects for update
  using (bucket_id = 'producao-raw' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "dono apaga seus brutos" on storage.objects;
create policy "dono apaga seus brutos" on storage.objects for delete
  using (bucket_id = 'producao-raw' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 1. PRODUCTION INBOX — material bruto
-- ============================================================
create table producao_brutos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  arquivo_url text, -- caminho no bucket producao-raw
  duracao_seg numeric,
  origem text,
  tamanho_bytes bigint,
  status text not null default 'novo' check (status in ('novo', 'em_projeto', 'processando', 'pronto', 'erro')),
  erro_mensagem text, -- mensagem segura, nunca stack trace
  created_at timestamptz not null default now()
);
alter table producao_brutos enable row level security;
create policy "producao_brutos_owner" on producao_brutos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 2. PRODUCTION PROJECT
-- ============================================================
create table producao_projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  tipo text check (tipo in ('vlog', 'grwm', 'fashion', 'gaming', 'cover', 'asmr', 'lifestyle', 'outro')),
  dna_id uuid, -- FK adicionada depois que producao_editing_dna existir (mais abaixo)
  status text not null default 'rascunho' check (status in ('rascunho', 'preparando', 'processando', 'revisao', 'aprovado', 'exportado', 'publicado')),
  descricao text,
  data date,
  observacoes text,
  projeto_id uuid references projetos(id) on delete set null, -- vinculo opcional com o Projetos MVP existente
  ordem bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table producao_projetos enable row level security;
create policy "producao_projetos_owner" on producao_projetos for all
  using (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from projetos where projetos.id = producao_projetos.projeto_id and projetos.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from projetos where projetos.id = producao_projetos.projeto_id and projetos.user_id = auth.uid()))
  );

-- Brutos associados a um projeto (um bruto pode entrar em mais de um
-- projeto — por isso tabela de vinculo, nao coluna direto em brutos).
create table producao_projeto_brutos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  bruto_id uuid not null references producao_brutos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (projeto_id, bruto_id)
);
alter table producao_projeto_brutos enable row level security;
create policy "producao_projeto_brutos_owner" on producao_projeto_brutos for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_projeto_brutos.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_projeto_brutos.bruto_id and producao_brutos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_projeto_brutos.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_projeto_brutos.bruto_id and producao_brutos.user_id = auth.uid())
  );

-- ============================================================
-- 3. SOURCE / DERIVED ASSETS
-- Derivado pode ainda nao ser um Asset formal da biblioteca (arquivo_url
-- interno) ou ja ter virado um (tabela_asset+asset_id, polimorfico igual
-- projeto_itens) — nunca os dois vazios.
-- ============================================================
create table producao_derivados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  bruto_origem_id uuid not null references producao_brutos(id) on delete cascade,
  tipo text not null check (tipo in ('long_edit', 'short', 'reel', 'tiktok', 'youtube_short', 'thumbnail', 'caption', 'subtitle', 'audio', 'proxy', 'transcript', 'other')),
  versao int not null default 1,
  tabela_asset text,
  asset_id uuid,
  arquivo_url text,
  created_at timestamptz not null default now(),
  constraint producao_derivados_arquivo_check check (tabela_asset is not null or arquivo_url is not null)
);
alter table producao_derivados enable row level security;
create policy "producao_derivados_owner" on producao_derivados for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_derivados.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_derivados.bruto_origem_id and producao_brutos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_derivados.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_derivados.bruto_origem_id and producao_brutos.user_id = auth.uid())
  );

-- ============================================================
-- 4. TRANSCRICAO — estrutura + estado, sem engine propria (provider
-- abstrato, ver src/lib/production/providers.ts)
-- ============================================================
create table producao_transcricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bruto_id uuid not null references producao_brutos(id) on delete cascade,
  provider text,
  status text not null default 'nao_iniciado' check (status in ('nao_iniciado', 'processando', 'pronto', 'erro')),
  erro_mensagem text,
  created_at timestamptz not null default now()
);
alter table producao_transcricoes enable row level security;
create policy "producao_transcricoes_owner" on producao_transcricoes for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_transcricoes.bruto_id and producao_brutos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_transcricoes.bruto_id and producao_brutos.user_id = auth.uid())
  );

create table producao_transcricao_segmentos (
  id uuid primary key default gen_random_uuid(),
  transcricao_id uuid not null references producao_transcricoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_ms int not null,
  end_ms int not null,
  texto text not null,
  speaker text,
  confidence numeric,
  ordem bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table producao_transcricao_segmentos enable row level security;
create policy "producao_transcricao_segmentos_owner" on producao_transcricao_segmentos for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_transcricoes where producao_transcricoes.id = producao_transcricao_segmentos.transcricao_id and producao_transcricoes.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_transcricoes where producao_transcricoes.id = producao_transcricao_segmentos.transcricao_id and producao_transcricoes.user_id = auth.uid())
  );
create index producao_transcricao_segmentos_transcricao_idx on producao_transcricao_segmentos(transcricao_id);

-- ============================================================
-- 5. MOMENTOS (AI Director) — score nunca e verdade absoluta, so
-- ranking interno quando existir.
-- ============================================================
create table producao_momentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bruto_id uuid not null references producao_brutos(id) on delete cascade,
  start_ms int not null,
  end_ms int not null,
  titulo text not null,
  descricao text,
  categoria text check (categoria in ('hook', 'engracado', 'fashion', 'grwm', 'historia', 'informativo', 'emocional', 'visual', 'outro')),
  score numeric,
  reason text,
  status text not null default 'sugerido' check (status in ('sugerido', 'aprovado', 'descartado')),
  created_at timestamptz not null default now()
);
alter table producao_momentos enable row level security;
create policy "producao_momentos_owner" on producao_momentos for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_momentos.bruto_id and producao_brutos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_momentos.bruto_id and producao_brutos.user_id = auth.uid())
  );

-- ============================================================
-- 6. CLIPS
-- ============================================================
create table producao_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  bruto_id uuid not null references producao_brutos(id) on delete cascade,
  momento_id uuid references producao_momentos(id) on delete set null,
  start_ms int not null,
  end_ms int not null,
  nome text not null,
  formato text not null check (formato in ('tiktok', 'reel', 'short', 'youtube', 'custom')),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9', '1:1', 'custom')),
  status text not null default 'draft' check (status in ('draft', 'queued', 'processing', 'review', 'approved', 'rejected', 'exported')),
  derivado_id uuid references producao_derivados(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table producao_clips enable row level security;
create policy "producao_clips_owner" on producao_clips for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_clips.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_clips.bruto_id and producao_brutos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_clips.momento_id and producao_momentos.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_clips.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_clips.bruto_id and producao_brutos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_clips.momento_id and producao_momentos.user_id = auth.uid()))
  );

-- ============================================================
-- 7/8. FEEDBACK — nunca "treina IA" sozinho, so dado estruturado.
-- ============================================================
create table producao_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clip_id uuid not null references producao_clips(id) on delete cascade,
  tipo text not null check (tipo in ('gostei', 'nao_gostei', 'ajustar')),
  tags text[] not null default '{}',
  comentario text,
  created_at timestamptz not null default now()
);
alter table producao_feedbacks enable row level security;
create policy "producao_feedbacks_owner" on producao_feedbacks for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_clips where producao_clips.id = producao_feedbacks.clip_id and producao_clips.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_clips where producao_clips.id = producao_feedbacks.clip_id and producao_clips.user_id = auth.uid())
  );

-- ============================================================
-- 9. EDITING DNA
-- ============================================================
create table producao_editing_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table producao_editing_dna enable row level security;
create policy "producao_editing_dna_owner" on producao_editing_dna for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table producao_projetos add constraint producao_projetos_dna_fk foreign key (dna_id) references producao_editing_dna(id) on delete set null;

-- policy de producao_projetos recriada incluindo a checagem de ownership do dna_id
drop policy if exists "producao_projetos_owner" on producao_projetos;
create policy "producao_projetos_owner" on producao_projetos for all
  using (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from projetos where projetos.id = producao_projetos.projeto_id and projetos.user_id = auth.uid()))
    and (dna_id is null or exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_projetos.dna_id and producao_editing_dna.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from projetos where projetos.id = producao_projetos.projeto_id and projetos.user_id = auth.uid()))
    and (dna_id is null or exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_projetos.dna_id and producao_editing_dna.user_id = auth.uid()))
  );

create table producao_dna_regras (
  id uuid primary key default gen_random_uuid(),
  dna_id uuid not null references producao_editing_dna(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null check (categoria in ('ritmo', 'jump_cuts', 'silencio', 'legendas', 'zoom', 'transicoes', 'audio', 'cor', 'musica', 'sfx')),
  regra text not null,
  ordem bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table producao_dna_regras enable row level security;
create policy "producao_dna_regras_owner" on producao_dna_regras for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_regras.dna_id and producao_editing_dna.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_regras.dna_id and producao_editing_dna.user_id = auth.uid())
  );

-- Referencias do DNA: Asset (polimorfico, igual projeto_itens) ou
-- criador do Radar (associacao, nunca duplica — mesmo padrao de Refs/
-- echo_radar_criadores).
create table producao_dna_referencias (
  id uuid primary key default gen_random_uuid(),
  dna_id uuid not null references producao_editing_dna(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('asset', 'radar_criador')),
  tabela_asset text,
  asset_id uuid,
  radar_criador_id uuid,
  created_at timestamptz not null default now(),
  constraint producao_dna_referencias_alvo_check check (
    (tipo = 'asset' and tabela_asset is not null and asset_id is not null and radar_criador_id is null) or
    (tipo = 'radar_criador' and radar_criador_id is not null and tabela_asset is null and asset_id is null)
  )
);
alter table producao_dna_referencias enable row level security;
create policy "producao_dna_referencias_owner" on producao_dna_referencias for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_referencias.dna_id and producao_editing_dna.user_id = auth.uid())
    and (radar_criador_id is null or exists (select 1 from radar_criadores where radar_criadores.id = producao_dna_referencias.radar_criador_id and radar_criadores.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_referencias.dna_id and producao_editing_dna.user_id = auth.uid())
    and (radar_criador_id is null or exists (select 1 from radar_criadores where radar_criadores.id = producao_dna_referencias.radar_criador_id and radar_criadores.user_id = auth.uid()))
  );

-- ============================================================
-- 10. PRESET DE LEGENDA — fonte por relacao com a tabela Fontes
-- existente, nunca duplicada.
-- ============================================================
create table producao_legenda_presets (
  id uuid primary key default gen_random_uuid(),
  dna_id uuid not null references producao_editing_dna(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Preset',
  fonte_asset_id uuid references fontes(id) on delete set null,
  tamanho int,
  posicao text,
  alinhamento text,
  max_linhas int,
  destacar_palavras_chave boolean not null default false,
  caixa text check (caixa is null or caixa in ('normal', 'maiuscula', 'minuscula')),
  contorno boolean not null default false,
  sombra boolean not null default false,
  created_at timestamptz not null default now()
);
alter table producao_legenda_presets enable row level security;
create policy "producao_legenda_presets_owner" on producao_legenda_presets for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_legenda_presets.dna_id and producao_editing_dna.user_id = auth.uid())
    and (fonte_asset_id is null or exists (select 1 from fontes where fontes.id = producao_legenda_presets.fonte_asset_id and fontes.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_legenda_presets.dna_id and producao_editing_dna.user_id = auth.uid())
    and (fonte_asset_id is null or exists (select 1 from fontes where fontes.id = producao_legenda_presets.fonte_asset_id and fontes.user_id = auth.uid()))
  );

-- ============================================================
-- 11. REGRAS DE AUTO EDIT — settings numericos estruturados por DNA
-- (1 linha por DNA). Sao SUGESTOES pro renderer futuro — nunca aplicadas
-- de forma irreversivel, o bruto nunca e alterado.
-- ============================================================
create table producao_dna_auto_edit (
  id uuid primary key default gen_random_uuid(),
  dna_id uuid not null references producao_editing_dna(id) on delete cascade unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  remover_silencio_acima_ms int,
  preservar_silencio_abaixo_ms int,
  jump_cut boolean not null default false,
  zoom_intensidade_max numeric,
  zoom_intervalo_min_ms int,
  plano_duracao_min_ms int,
  plano_duracao_max_ms int,
  created_at timestamptz not null default now()
);
alter table producao_dna_auto_edit enable row level security;
create policy "producao_dna_auto_edit_owner" on producao_dna_auto_edit for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_auto_edit.dna_id and producao_editing_dna.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_editing_dna where producao_editing_dna.id = producao_dna_auto_edit.dna_id and producao_editing_dna.user_id = auth.uid())
  );

-- ============================================================
-- 12. EDIT DECISIONS — usado futuramente pelo renderer. payload jsonb
-- guarda campos especificos por tipo (scale no zoom, texto na caption
-- etc.) sem precisar de uma coluna por combinacao possivel.
-- ============================================================
create table producao_edit_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  bruto_id uuid not null references producao_brutos(id) on delete cascade,
  tipo text not null check (tipo in ('cut', 'keep', 'zoom', 'caption', 'broll', 'audio', 'transition', 'other')),
  start_ms int not null,
  end_ms int not null,
  payload jsonb not null default '{}'::jsonb,
  ordem bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table producao_edit_decisions enable row level security;
create policy "producao_edit_decisions_owner" on producao_edit_decisions for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_edit_decisions.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_edit_decisions.bruto_id and producao_brutos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_edit_decisions.projeto_id and producao_projetos.user_id = auth.uid())
    and exists (select 1 from producao_brutos where producao_brutos.id = producao_edit_decisions.bruto_id and producao_brutos.user_id = auth.uid())
  );

-- ============================================================
-- 13. B-ROLL SUGGESTIONS — busca so nos proprios Assets, nunca externa
-- (nesta rodada nem isso — so o registro estruturado).
-- ============================================================
create table producao_broll_sugestoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  momento_id uuid references producao_momentos(id) on delete set null,
  timestamp_ms int,
  sugestao text not null,
  query_descricao text,
  tabela_asset text,
  asset_id uuid,
  status text not null default 'sugerido' check (status in ('sugerido', 'selecionado', 'ignorado')),
  created_at timestamptz not null default now()
);
alter table producao_broll_sugestoes enable row level security;
create policy "producao_broll_sugestoes_owner" on producao_broll_sugestoes for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_broll_sugestoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_broll_sugestoes.momento_id and producao_momentos.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_broll_sugestoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (momento_id is null or exists (select 1 from producao_momentos where producao_momentos.id = producao_broll_sugestoes.momento_id and producao_momentos.user_id = auth.uid()))
  );

-- ============================================================
-- 14. RENDER / PRODUCTION JOBS — modelo + servico, sem fila de verdade
-- ainda (worker futuro consome isso). Nunca guarda stack trace no campo
-- visivel ao cliente.
-- ============================================================
create table producao_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid references producao_projetos(id) on delete cascade,
  tipo text not null check (tipo in ('transcribe', 'analyze', 'detect_moments', 'render_clip', 'render_long', 'captions', 'normalize_audio', 'tracking', 'export')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progresso int not null default 0 check (progresso between 0 and 100),
  erro_mensagem text,
  referencia_tabela text,
  referencia_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table producao_jobs enable row level security;
create policy "producao_jobs_owner" on producao_jobs for all
  using (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from producao_projetos where producao_projetos.id = producao_jobs.projeto_id and producao_projetos.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and (projeto_id is null or exists (select 1 from producao_projetos where producao_projetos.id = producao_jobs.projeto_id and producao_projetos.user_id = auth.uid()))
  );

-- ============================================================
-- 17. PUBLICATION + METRICS
-- ============================================================
create table producao_publicacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  clip_id uuid references producao_clips(id) on delete set null,
  plataforma text not null check (plataforma in ('tiktok', 'instagram', 'youtube', 'outro')),
  external_id text,
  url text,
  titulo_legenda text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
alter table producao_publicacoes enable row level security;
create policy "producao_publicacoes_owner" on producao_publicacoes for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_publicacoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (clip_id is null or exists (select 1 from producao_clips where producao_clips.id = producao_publicacoes.clip_id and producao_clips.user_id = auth.uid()))
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_publicacoes.projeto_id and producao_projetos.user_id = auth.uid())
    and (clip_id is null or exists (select 1 from producao_clips where producao_clips.id = producao_publicacoes.clip_id and producao_clips.user_id = auth.uid()))
  );

create table producao_metricas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publicacao_id uuid not null references producao_publicacoes(id) on delete cascade,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_time_seg numeric,
  avg_watch_time_seg numeric,
  completion_rate numeric,
  followers_gain int,
  captured_at timestamptz not null default now()
);
alter table producao_metricas enable row level security;
create policy "producao_metricas_owner" on producao_metricas for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_publicacoes where producao_publicacoes.id = producao_metricas.publicacao_id and producao_publicacoes.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_publicacoes where producao_publicacoes.id = producao_metricas.publicacao_id and producao_publicacoes.user_id = auth.uid())
  );

-- ============================================================
-- 19. CREATOR MEMORY
-- ============================================================
create table producao_memoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('pessoa', 'lugar', 'serie', 'assunto', 'produto', 'look', 'projeto', 'outro')),
  nome text not null,
  descricao text,
  created_at timestamptz not null default now()
);
alter table producao_memoria enable row level security;
create policy "producao_memoria_owner" on producao_memoria for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table producao_memoria_projetos (
  id uuid primary key default gen_random_uuid(),
  memoria_id uuid not null references producao_memoria(id) on delete cascade,
  projeto_id uuid not null references producao_projetos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memoria_id, projeto_id)
);
alter table producao_memoria_projetos enable row level security;
create policy "producao_memoria_projetos_owner" on producao_memoria_projetos for all
  using (
    auth.uid() = user_id
    and exists (select 1 from producao_memoria where producao_memoria.id = producao_memoria_projetos.memoria_id and producao_memoria.user_id = auth.uid())
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_memoria_projetos.projeto_id and producao_projetos.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from producao_memoria where producao_memoria.id = producao_memoria_projetos.memoria_id and producao_memoria.user_id = auth.uid())
    and exists (select 1 from producao_projetos where producao_projetos.id = producao_memoria_projetos.projeto_id and producao_projetos.user_id = auth.uid())
  );

create index producao_projeto_brutos_projeto_idx on producao_projeto_brutos(projeto_id);
create index producao_derivados_projeto_idx on producao_derivados(projeto_id);
create index producao_momentos_bruto_idx on producao_momentos(bruto_id);
create index producao_clips_projeto_idx on producao_clips(projeto_id);
create index producao_jobs_projeto_idx on producao_jobs(projeto_id);
create index producao_publicacoes_projeto_idx on producao_publicacoes(projeto_id);

notify pgrst, 'reload schema';
