import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Protecao server-side das rotas privadas do ECHO // ASSETS. Mesma logica
// do echo-os-app: a sessao ja e cookie-based (createBrowserClient em
// src/lib/supabase/client.ts), entao o middleware consegue validar ela
// antes de qualquer pagina privada renderizar.
//
// Publicas: /login (senao ninguem entra), e /api/* fica fora do matcher —
// x-import/x-media sao publicas por design (funcionam antes de salvar um
// meme, ver src/app/api/x-import e x-media), sem checagem de sessao la
// nem aqui.
const ROTAS_PUBLICAS = ["/login"];

function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export async function middleware(request: NextRequest) {
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
          cookiesParaGravar.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const rotaPublica = ehRotaPublica(request.nextUrl.pathname);

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Mesma conta/projeto do echo-os-app: se o MFA foi ativado por la, uma
  // sessao aal1 (so senha, TOTP pendente) nao pode acessar rota privada
  // nenhuma aqui tambem — senao esse app vira uma porta lateral que dribla
  // o segundo fator.
  if (user && !rotaPublica) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
