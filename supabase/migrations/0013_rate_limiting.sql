-- ECHO — rate limiting (Fase 2 da auditoria de seguranca, item #2).
-- Mesma tabela/funcao usada pelas rotas de API do echo-os-app — os dois
-- apps compartilham o mesmo projeto Supabase, entao essa migracao so
-- precisa ser rodada UMA VEZ (se ja rodou 0059_rate_limiting.sql no
-- echo-os-app, pode pular esta). Mantida aqui so pra documentar que o
-- echo-memes tambem depende dela (usada no upload, via enviarArquivo).
-- Roda inteiro no SQL Editor.

create table if not exists api_rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contagem int not null default 0
);

alter table api_rate_limits enable row level security;

create or replace function checar_rate_limit(p_chave text, p_limite int, p_janela_seg int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem int;
begin
  insert into api_rate_limits (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem = case
      when api_rate_limits.janela_inicio < now() - (p_janela_seg || ' seconds')::interval
        then 1
      else api_rate_limits.contagem + 1
    end,
    janela_inicio = case
      when api_rate_limits.janela_inicio < now() - (p_janela_seg || ' seconds')::interval
        then now()
      else api_rate_limits.janela_inicio
    end
  returning contagem into v_contagem;

  return v_contagem <= p_limite;
end;
$$;

grant execute on function checar_rate_limit(text, int, int) to authenticated;

notify pgrst, 'reload schema';
