import { NextRequest, NextResponse } from "next/server";

// Proxy da midia do X — o navegador nao consegue baixar video.twimg.com/pbs.twimg.com
// direto por CORS, entao o servidor busca e repassa os bytes. So aceita esses dois
// hosts (evita virar proxy aberto pra qualquer URL).

const HOSTS_PERMITIDOS = ["video.twimg.com", "pbs.twimg.com"];

export async function GET(request: NextRequest) {
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
