// CSP — hardening fase 9. Dominios fixos mapeados por grep em toda src/:
// so cdn.syndication.twimg.com e www.tiktok.com sao chamados (e so do
// SERVIDOR, dentro de /api/x-import — nao entram no connect-src do
// navegador). O client so carrega: Supabase (auth/storage/rest, mesmo
// projeto do echo-os-app) e imagens — memes/audios/visuais do proprio
// Storage (signed URL) MAIS avatar_url de criadores importados do Radar,
// que vem de perfis reais de TikTok/YouTube/Instagram com host de CDN
// variavel (muda por plataforma e por creator, nao da pra prever um
// dominio fixo). Por isso img-src usa "https:" amplo so pra imagem —
// unica diretiva assim nesta CSP, documentado como decisao consciente
// (nao e "*" geral: script/connect/frame continuam restritos a origem
// propria + Supabase). 'unsafe-inline' em script-src e style-src e a
// mesma concessao do echo-os-app — Next App Router injeta script inline
// de hidratacao e o app usa style={{...}} dinamico — dívida documentada,
// nao nonce ainda.
// media-src: video e audio dos Memes/Audios/Visuais/Edicoes tambem vem do
// Storage por URL assinada (https). Sem esta diretiva o default-src 'self'
// bloqueava <video>/<audio> e o card mostrava "Sem arquivo" mesmo com o
// arquivo existindo.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
