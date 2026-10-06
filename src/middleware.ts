import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ehAdmin, podeUsarAssets } from "@/lib/server/acesso";

// Protecao server-side das rotas privadas do ECHO // ASSETS. Mesma logica
// do echo-os-app (mesmo projeto Supabase).
//
// Publicas: /login e /sem-acesso. /api/* fica fora do matcher: cada rota
// valida a propria sessao e o acesso com protegerRota (src/lib/server/
// apiGuard.ts) e responde 401/403 em JSON em vez de redirect.
//
// Regras para quem tem sessao:
// 1. MFA pendente (conta com TOTP, sessao so com senha) -> volta ao login.
// 2. Admin sem MFA cadastrado -> 403 pedindo para ativar no ECHO.
// 3. Convidado so entra se app_metadata.espacos tiver "assets".
const ROTAS_PUBLICAS = ["/login", "/sem-acesso"];

function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function semAcesso(request: NextRequest, motivo?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/sem-acesso";
  url.search = motivo ? `?motivo=${motivo}` : "";
  return NextResponse.rewrite(url, { status: 403 });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (ehRotaPublica(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaGravar) {
          cookiesParaGravar.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesParaGravar.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, sameSite: "lax", secure: process.env.NODE_ENV === "production" }),
          );
        },
      },
    }
  );

  // getUser() valida o JWT na Auth API (getSession so leria o cookie).
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Mesma conta/projeto do echo-os-app: uma sessao aal1 (so senha, TOTP
  // pendente) nao entra aqui, senao esse app vira uma porta lateral que
  // dribla o segundo fator.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (ehAdmin(user) && aal?.nextLevel !== "aal2") return semAcesso(request, "mfa");
  if (!podeUsarAssets(user)) return semAcesso(request);

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
