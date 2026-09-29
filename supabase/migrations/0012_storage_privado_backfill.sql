-- ECHO // ASSETS — storage privado, passo 1 (backfill).
-- O codigo agora grava so o CAMINHO do arquivo no bucket, nao mais a URL
-- publica inteira, e resolve URL assinada na hora de exibir/baixar. Essa
-- migracao converte as linhas ja gravadas (URL publica completa) pra caminho
-- puro, pra bater com o novo formato. Idempotente: linha que ja e caminho
-- puro (sem "/storage/v1/object/public/") nao e tocada.
-- Roda inteiro no SQL Editor. NAO torna o bucket privado ainda — isso e um
-- passo separado, so depois que os dois apps (echo-memes e echo-os-app)
-- estiverem publicados usando URL assinada.

update memes set imagem_url = regexp_replace(imagem_url, '^.*/storage/v1/object/public/life-os/', '')
  where imagem_url like '%/storage/v1/object/public/life-os/%';

update audios set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update visuais set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update templates set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update fontes set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update brand_assets set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update paletas set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';

update edicoes_referencia set arquivo_url = regexp_replace(arquivo_url, '^.*/storage/v1/object/public/life-os/', '')
  where arquivo_url like '%/storage/v1/object/public/life-os/%';
