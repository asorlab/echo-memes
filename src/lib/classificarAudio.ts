import type { CategoriaSfx, TipoAudio } from "./types";

// Sugere o tipo de um audio novo pelo NOME do arquivo e pela DURACAO, para nao
// cair tudo como "Musica". Ordem: tipo escolhido no filtro (a pessoa mandou) >
// palavra no nome > duracao (ate 4 s quase sempre e efeito sonoro). Nunca e
// definitivo: o painel do item continua editavel.

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PALAVRAS_TIPO: [TipoAudio, RegExp][] = [
  ["sfx", /\b(sfx|whoosh|swoosh|swish|impact|impacto|hit|punch|click|clique|pop|ding|beep|bip|notif|alert|riser|boom|glitch|swipe|transition|transicao|stinger)\b/],
  ["ambiente", /\b(ambiente|ambience|ambient|room ?tone|chuva|rain|vento|wind|cidade|city|lab|natureza|nature|noise|ruido)\b/],
  ["fala", /\b(fala|voz|voice|vo|narra\w*|locucao|podcast|entrevista|dialogo|audio ?whats)\b/],
  ["trend", /\b(trend|tiktok|viral|reels?|meme)\b/],
  ["musica", /\b(musica|music|song|beat|instrumental|lofi|lo-fi|trilha|soundtrack|remix|bpm)\b/],
];

const PALAVRAS_SFX: [CategoriaSfx, RegExp][] = [
  ["whoosh", /\b(whoosh|swoosh|swish|swipe)\b/],
  ["impacto", /\b(impact|impacto|hit|punch|boom|thud)\b/],
  ["notificacao", /\b(notif\w*|ding|beep|bip|alert\w*|ping)\b/],
  ["transicao", /\b(transition|transicao|riser|stinger)\b/],
  ["risada", /\b(risada|laugh|haha|kkk+)\b/],
  ["erro", /\b(erro|error|fail|wrong)\b/],
  ["sucesso", /\b(sucesso|success|win|correct|level ?up)\b/],
  ["ambiente", /\b(ambiente|ambience|room ?tone)\b/],
];

export interface SugestaoAudio { tipo: TipoAudio; categoriaSfx: CategoriaSfx | null; motivo: "escolhido" | "nome" | "duracao" | "padrao" }

export function sugerirTipoAudio(nomeArquivo: string, duracaoSeg: number | null | undefined, tipoEscolhido: TipoAudio | null): SugestaoAudio {
  const nome = sem(nomeArquivo.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " "));
  const categoria = PALAVRAS_SFX.find(([, re]) => re.test(nome))?.[0] ?? null;
  if (tipoEscolhido) return { tipo: tipoEscolhido, categoriaSfx: tipoEscolhido === "sfx" ? categoria : null, motivo: "escolhido" };
  const peloNome = PALAVRAS_TIPO.find(([, re]) => re.test(nome))?.[0];
  if (peloNome) return { tipo: peloNome, categoriaSfx: peloNome === "sfx" ? categoria ?? "outro" : null, motivo: "nome" };
  if (duracaoSeg != null && duracaoSeg > 0 && duracaoSeg <= 4) return { tipo: "sfx", categoriaSfx: categoria ?? "outro", motivo: "duracao" };
  return { tipo: "musica", categoriaSfx: null, motivo: "padrao" };
}
