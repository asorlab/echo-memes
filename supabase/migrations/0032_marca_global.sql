-- ECHO // ASSETS: marca global (Fase 1 do Creator OS).
--
-- marca_slug: 'iveasor' ou 'asor_lab' = da marca; vazio (null) = compartilhado,
-- aparece nas duas. aivil e geral continuam so como etiqueta (nao viram marca).
--
-- 1) Coluna nova nas bibliotecas, referencias, projetos, producao e DNA.
-- 2) Preenche a coluna nova SO onde ja existe a marca na etiqueta antiga:
--    memes.categoria e inspiracoes.marca ('iveasor' -> iveasor, 'asor' -> asor_lab).
--    As colunas antigas NAO mudam; so linhas com marca_slug ainda vazio sao tocadas.
--
-- Nao apaga nada. As policies existentes (dono-only) valem para a coluna nova.
-- Roda inteiro no SQL Editor (sem selecionar trecho).

alter table memes                add column if not exists marca_slug text;
alter table audios               add column if not exists marca_slug text;
alter table visuais              add column if not exists marca_slug text;
alter table fontes               add column if not exists marca_slug text;
alter table brand_assets         add column if not exists marca_slug text;
alter table paletas              add column if not exists marca_slug text;
alter table inspiracoes          add column if not exists marca_slug text;
alter table edicoes_referencia   add column if not exists marca_slug text;
alter table projetos             add column if not exists marca_slug text;
alter table producao_projetos    add column if not exists marca_slug text;
alter table producao_editing_dna add column if not exists marca_slug text;

do $$
declare t text;
begin
  foreach t in array array['memes','audios','visuais','fontes','brand_assets','paletas','inspiracoes',
                           'edicoes_referencia','projetos','producao_projetos','producao_editing_dna']
  loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_marca_slug_check');
    execute format('alter table %I add constraint %I check (marca_slug in (''iveasor'', ''asor_lab''))', t, t || '_marca_slug_check');
  end loop;
end $$;

update memes set marca_slug = case categoria when 'iveasor' then 'iveasor' when 'asor' then 'asor_lab' end
  where marca_slug is null and categoria in ('iveasor', 'asor');
update inspiracoes set marca_slug = case marca when 'iveasor' then 'iveasor' when 'asor' then 'asor_lab' end
  where marca_slug is null and marca in ('iveasor', 'asor');

notify pgrst, 'reload schema';

select table_name from information_schema.columns
where column_name = 'marca_slug' and table_schema = 'public'
order by table_name;
