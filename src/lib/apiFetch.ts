import { supabaseBrowser } from "./supabase/client";

// Wrapper de fetch pras rotas /api/* privadas: anexa o token da sessao atual
// no header Authorization, que o servidor valida antes de fazer qualquer
// chamada externa. Uso identico ao fetch normal.
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabaseBrowser().auth.getSession();
  const headers = new Headers(init?.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
