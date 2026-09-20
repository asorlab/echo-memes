import { NextRequest, NextResponse } from "next/server";

// Busca dados de um post do X (texto, autor, melhor midia) via endpoint publico
// de sindicacao que o proprio X usa pra embeds — nao precisa de login/API key.

interface VarianteVideo {
  bitrate?: number;
  content_type: string;
  url: string;
}

interface MidiaDetalhe {
  type: "photo" | "video" | "animated_gif";
  media_url_https: string;
  video_info?: { variants: VarianteVideo[] };
}

function extrairId(url: string): string | null {
  const m = url.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ erro: "Link obrigatorio" }, { status: 400 });

  const id = extrairId(url);
  if (!id) return NextResponse.json({ erro: "Nao encontrei o id do post nesse link" }, { status: 400 });

  try {
    const resposta = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resposta.ok) {
      return NextResponse.json({ erro: "Nao encontrei esse post (pode ter sido removido, ou a conta e privada)" }, { status: 404 });
    }
    const dados = await resposta.json();

    const midia = (dados.mediaDetails as MidiaDetalhe[] | undefined)?.[0];
    if (!midia) {
      return NextResponse.json({ erro: "Esse post nao tem imagem nem video" }, { status: 404 });
    }

    let midiaUrl: string;
    let tipo: "video" | "imagem";
    if (midia.type === "video" || midia.type === "animated_gif") {
      const variantes = (midia.video_info?.variants ?? []).filter((v) => v.content_type === "video/mp4");
      variantes.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      if (!variantes[0]) return NextResponse.json({ erro: "Nao consegui achar o video desse post" }, { status: 404 });
      midiaUrl = variantes[0].url;
      tipo = "video";
    } else {
      midiaUrl = midia.media_url_https;
      tipo = "imagem";
    }

    return NextResponse.json({
      texto: (dados.text as string | undefined)?.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "").trim() ?? "",
      autor: (dados.user as { screen_name?: string } | undefined)?.screen_name ?? "",
      midiaUrl,
      tipo,
    });
  } catch {
    return NextResponse.json({ erro: "Erro ao buscar esse post" }, { status: 500 });
  }
}
