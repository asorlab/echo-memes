import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Guarda compartilhada pelas rotas de API privadas do ECHO // ASSETS —
// mesmo padrao ja usado no echo-os-app (mesmo projeto Supabase). Exige
// sessao Supabase legitima (nunca confia em estado do frontend) e aplica
// rate limit por usuario antes de deixar a rota fazer qualquer coisa.
// Roda so no servidor — as chaves aqui nunca chegam no navegador.
//
// Hardening fase 3: criado porque /api/x-import nao tinha NENHUMA
// autenticacao nem rate limit — endpoint publico que qualquer um na
// internet podia chamar indefinidamente.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function clienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return null;
  return createClient(SUPABASE_URL, chave);
}

function extrairToken(request: NextRequest): string | null {
  const cabecalho = request.headers.get("authorization");
  if (!cabecalho?.startsWith("Bearer ")) return null;
  return cabecalho.slice(7).trim() || null;
}

async function usuarioDoToken(token: string): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function dentroDoLimite(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  const admin = clienteAdmin();
  if (!admin) {
    console.error("SUPABASE_SECRET_KEY nao configurada — rate limit desativado nesta chamada");
    return true;
  }
  const { data, error } = await admin.rpc("checar_rate_limit", {
    p_chave: chave,
    p_limite: limite,
    p_janela_seg: janelaSeg,
  });
  if (error) {
    console.error("rate limit check falhou:", error.message);
    return true;
  }
  return data === true;
}

export interface OpcoesGuarda {
  limite: number;
  janelaSeg: number;
}

export type ResultadoGuarda = { userId: string } | NextResponse;

export function ehResposta(resultado: ResultadoGuarda): resultado is NextResponse {
  return resultado instanceof NextResponse;
}

export async function protegerRota(request: NextRequest, opcoes: OpcoesGuarda): Promise<ResultadoGuarda> {
  const token = extrairToken(request);
  const userId = token ? await usuarioDoToken(token) : null;
  if (!userId) {
    return NextResponse.json({ erro: "Nao autenticado" }, { status: 401 });
  }

  const chave = `${userId}:${new URL(request.url).pathname}`;
  const permitido = await dentroDoLimite(chave, opcoes.limite, opcoes.janelaSeg);
  if (!permitido) {
    return NextResponse.json({ erro: "Muitas requisicoes — tenta de novo em instantes" }, { status: 429 });
  }

  return { userId };
}
