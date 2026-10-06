import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Utilitarios de servidor para as rotas de autenticacao: cliente Supabase
// que grava a sessao em cookie, cliente admin (chave secreta, so servidor),
// rate limit e auditoria. Mesmo desenho do echo-os-app.

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function supabaseRota() {
  const cookieStore = cookies();
  return createServerClient(URL_SUPABASE, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(lista) {
        lista.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, { ...options, sameSite: "lax", secure: process.env.NODE_ENV === "production" }),
        );
      },
    },
  });
}

function supabaseAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return null;
  return createClient(URL_SUPABASE, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function origemDaRequisicao(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "desconhecido";
  const pais = request.headers.get("x-vercel-ip-country") ?? null;
  return { ip, pais };
}

/** Conta uma tentativa na chave e diz se ainda esta dentro do limite. Sem chave secreta, falha aberta. */
export async function dentroDoLimite(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  const admin = supabaseAdmin();
  if (!admin) {
    console.warn("rate limit inativo: SUPABASE_SECRET_KEY ausente no servidor");
    return true;
  }
  const { data, error } = await admin.rpc("checar_rate_limit", { p_chave: chave, p_limite: limite, p_janela_seg: janelaSeg });
  if (error) {
    console.warn("rate limit indisponivel:", error.message);
    return true;
  }
  return data === true;
}

/** Grava no audit_log pelo servidor. Nunca guarda senha, token nem segredo. */
export async function auditar(evento: string, userId: string | null, metadata: Record<string, unknown>) {
  const admin = supabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from("audit_log").insert({ user_id: userId, evento, resource_type: "auth", metadata: { ...metadata, app: "assets" } });
  if (error) console.warn("auditoria nao registrada:", error.message);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validacao minima do corpo (o projeto nao usa zod). */
export function lerCorpo(bruto: unknown, comSenha: boolean) {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return null;
  const senha = typeof b.senha === "string" ? b.senha : "";
  if (comSenha && (senha.length < 1 || senha.length > 200)) return null;
  const captchaToken = typeof b.captchaToken === "string" && b.captchaToken.length <= 4096 ? b.captchaToken : undefined;
  return { email, senha, captchaToken };
}
