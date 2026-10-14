import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mensagemErroBanco } from "./erroBanco";

let client: SupabaseClient | null = null;

export function supabaseConfigurado() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const EVENTO_ERRO_BANCO = "echo:erro-banco";

// Gravação recusada pelo banco (insert/update/delete) vira aviso na tela, mesmo onde a tela
// esqueceu de conferir o erro. 409 (já existe) fica de fora: quem grava trata como esperado.
const fetchQueAvisa: typeof fetch = async (entrada, init) => {
  const resposta = await fetch(entrada, init);
  try {
    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (!resposta.ok && resposta.status !== 409 && metodo !== "GET" && metodo !== "HEAD" && url.includes("/rest/v1/") && typeof window !== "undefined") {
      const corpo = (await resposta.clone().json().catch(() => ({}))) as { message?: string };
      window.dispatchEvent(new CustomEvent(EVENTO_ERRO_BANCO, { detail: mensagemErroBanco(resposta.status, corpo.message ?? "") }));
    }
  } catch { /* o aviso nunca pode quebrar a gravação */ }
  return resposta;
};

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase nao configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
    );
  }
  client = createBrowserClient(url, anonKey, { global: { fetch: fetchQueAvisa } });
  return client;
}
