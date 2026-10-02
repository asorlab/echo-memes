import { NextRequest, NextResponse } from "next/server";
import { protegerRota, ehResposta } from "@/lib/server/apiGuard";

// Proxy da midia do X — o navegador nao consegue baixar video.twimg.com/pbs.twimg.com
// direto por CORS, entao o servidor busca e repassa os bytes. Allowlist de host
// (so esses dois) continua, mas isso nunca substitui autenticacao — allowlist
// so evita virar proxy aberto pra QUALQUER url, nao decide quem pode chamar a
// rota. Hardening fase 3: exige sessao ECHO valida antes de proxiar qualquer
// coisa.

const HOSTS_PERMITIDOS = ["video.twimg.com", "pbs.twimg.com"];

export async function GET(request: NextRequest) {
  const guarda = await protegerRota(request, { limite: 30, janelaSeg: 3600 });
  if (ehResposta(guarda)) return guarda;

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ erro: "url obrigatoria" }, { status: 400 });

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return NextResponse.json({ erro: "url invalida" }, { status: 400 });
  }
  if (!HOSTS_PERMITIDOS.includes(host)) {
    return NextResponse.json({ erro: "host nao permitido" }, { status: 400 });
  }

  const resposta = await fetch(url);
  if (!resposta.ok || !resposta.body) {
    return NextResponse.json({ erro: "Nao consegui baixar essa midia" }, { status: 502 });
  }
  return new NextResponse(resposta.body, {
    headers: { "content-type": resposta.headers.get("content-type") ?? "application/octet-stream" },
  });
}
