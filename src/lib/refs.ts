import { supabaseBrowser } from "./supabase/client";

// Refs = creators do Radar (iveasor) adicionados ao ECHO. O Radar continua
// sendo a fonte unica dos dados (nome, avatar, username, plataforma) — o
// ECHO so guarda o vinculo (echo_radar_criadores), nunca uma copia.

export interface PerfilRadar {
  plataforma: string;
  username: string;
  url: string;
}

export interface CriadorRadar {
  id: string;
  nome: string;
  avatarUrl: string | null;
  nicho: string;
  perfis: PerfilRadar[];
}

export interface RefAdicionada extends CriadorRadar {
  associacaoId: string;
  adicionadoEm: string;
}

async function buscarCriadoresComPerfis(userId: string, ids?: string[]): Promise<CriadorRadar[]> {
  const supabase = supabaseBrowser();
  let query = supabase.from("radar_criadores").select("id, nome, avatar_url, nicho").eq("user_id", userId).order("nome");
  if (ids) query = query.in("id", ids);
  const { data: criadores, error } = await query;
  if (error) throw error;
  if (!criadores || criadores.length === 0) return [];

  const { data: perfis, error: erroPerfis } = await supabase
    .from("radar_perfis")
    .select("criador_id, plataforma, username, url")
    .in("criador_id", criadores.map((c) => c.id));
  if (erroPerfis) throw erroPerfis;

  const perfisPorCriador: Record<string, PerfilRadar[]> = {};
  for (const p of perfis ?? []) {
    (perfisPorCriador[p.criador_id] ??= []).push({ plataforma: p.plataforma, username: p.username, url: p.url });
  }

  return criadores.map((c) => ({
    id: c.id,
    nome: c.nome,
    avatarUrl: c.avatar_url,
    nicho: c.nicho,
    perfis: perfisPorCriador[c.id] ?? [],
  }));
}

// Todos os creators do Radar dessa conta — pro seletor "Adicionar do Radar".
export async function listarCriadoresRadar(userId: string): Promise<CriadorRadar[]> {
  return buscarCriadoresComPerfis(userId);
}

// Refs ja adicionadas ao ECHO, com os dados atuais do Radar (nunca uma
// copia antiga — sempre lidos ao vivo de radar_criadores/radar_perfis).
export async function listarRefsAdicionadas(userId: string): Promise<RefAdicionada[]> {
  const supabase = supabaseBrowser();
  const { data: associacoes, error } = await supabase
    .from("echo_radar_criadores")
    .select("id, radar_criador_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!associacoes || associacoes.length === 0) return [];

  const criadores = await buscarCriadoresComPerfis(userId, associacoes.map((a) => a.radar_criador_id));
  const porId = Object.fromEntries(criadores.map((c) => [c.id, c]));

  return associacoes
    .filter((a) => porId[a.radar_criador_id])
    .map((a) => ({ ...porId[a.radar_criador_id], associacaoId: a.id, adicionadoEm: a.created_at }));
}

export async function adicionarRefsDoRadar(userId: string, radarCriadorIds: string[]): Promise<void> {
  if (radarCriadorIds.length === 0) return;
  const linhas = radarCriadorIds.map((id) => ({ user_id: userId, radar_criador_id: id }));
  const { error } = await supabaseBrowser().from("echo_radar_criadores").upsert(linhas, { onConflict: "user_id,radar_criador_id", ignoreDuplicates: true });
  if (error) throw error;
}

// So remove o vinculo — radar_criadores/radar_perfis continuam intactos.
export async function removerRefDoEcho(associacaoId: string): Promise<void> {
  const { error } = await supabaseBrowser().from("echo_radar_criadores").delete().eq("id", associacaoId);
  if (error) throw error;
}
