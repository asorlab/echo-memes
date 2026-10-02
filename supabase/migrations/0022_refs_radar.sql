-- ECHO // ASSETS — associacao com creators do Radar (iveasor), 30/09.
-- O Radar (echo-os-app, mesmo projeto Supabase) e a fonte unica dos dados
-- de creator — nome, avatar, username, plataforma continuam so em
-- radar_criadores/radar_perfis, nunca copiados aqui. Essa tabela guarda
-- SO o vinculo "esse creator do Radar foi adicionado ao ECHO", nada mais.
-- Sem campos especulativos (favorito/notas ficam pra quando forem
-- realmente necessarios).
--
-- RLS: dono-only, e o INSERT so passa se o radar_criador_id apontado
-- tambem pertencer ao mesmo usuario (impede associar creator de outra
-- conta). on delete cascade em radar_criador_id: se o creator for
-- removido no Radar, a associacao orfa some junto.
--
-- Migracao so aditiva/nova, nao mexe em radar_criadores/radar_perfis nem
-- em nenhuma tabela existente do ECHO.
-- Roda inteiro no SQL Editor.

create table if not exists echo_radar_criadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  radar_criador_id uuid references radar_criadores on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, radar_criador_id)
);

create index if not exists echo_radar_criadores_user_idx on echo_radar_criadores (user_id);

alter table echo_radar_criadores enable row level security;
drop policy if exists "dono ve so as proprias associacoes" on echo_radar_criadores;
create policy "dono ve so as proprias associacoes" on echo_radar_criadores for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from radar_criadores where radar_criadores.id = radar_criador_id and radar_criadores.user_id = auth.uid())
  );

notify pgrst, 'reload schema';
