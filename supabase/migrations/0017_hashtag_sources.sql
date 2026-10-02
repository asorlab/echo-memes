-- ECHO // ASSETS — Fontes por hashtag do TikTok, alem de perfil.
--
-- "source_type" marca o que a Fonte representa: 'profile' (comportamento
-- atual, sem mudanca) ou 'hashtag'. Hashtag e uma pagina sem fim (feed
-- algoritmico), entao toda Fonte hashtag carrega um "limite_itens"
-- obrigatorio (50/100/250) — cada sincronizacao le so os N mais recentes
-- dessa hashtag, nunca a pagina inteira. Novidade e dedup continuam
-- automaticos, via o unique(user_id, platform, external_id) que ja existe
-- em import_items.
--
-- Migracao so aditiva, idempotente (add column if not exists).
-- Roda inteiro no SQL Editor.

alter table import_sources
  add column if not exists source_type text not null default 'profile';

alter table import_sources
  add column if not exists limite_itens int;

notify pgrst, 'reload schema';
