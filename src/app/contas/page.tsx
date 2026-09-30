"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Rss, X } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import {
  listarFontes, adicionarFonteEExecutar, sincronizarFonte, listarExecucoes,
  type Fonte, type Execucao,
} from "@/lib/contas";
import ContaDrawer from "@/components/contas/ContaDrawer";

function detectarPlataforma(url: string): string | null {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/\b(x\.com|twitter\.com)\b/i.test(url)) return "x";
  return null;
}
function extrairUsername(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    if (platform === "tiktok") {
      const m = u.pathname.match(/^\/@([^/]+)/i);
      return m ? m[1] : null;
    }
    if (platform === "x") {
      const m = u.pathname.match(/^\/([^/]+)/i);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

const ROTULO_PLATAFORMA: Record<string, string> = { tiktok: "TikTok", x: "X" };

function formatarData(iso: string | null): string {
  if (!iso) return "nunca sincronizada";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function ContasPage() {
  const { user } = useUser();
  const toast = useToast();
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [execucoesPorFonte, setExecucoesPorFonte] = useState<Record<string, Execucao[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [novoLink, setNovoLink] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);
  const [fonteAbertaId, setFonteAbertaId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const lista = await listarFontes(user.id);
    setFontes(lista);
    setCarregando(false);
    const execs = await Promise.all(lista.map((f) => listarExecucoes(f.id)));
    setExecucoesPorFonte(Object.fromEntries(lista.map((f, i) => [f.id, execs[i]])));
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!user || !novoLink.trim()) return;
    const link = novoLink.trim();
    const platform = detectarPlataforma(link);
    if (!platform) { toast("Cola um link de perfil do TikTok ou X"); return; }
    const username = extrairUsername(link, platform);
    if (!username) { toast("Não consegui identificar o @usuário nesse link"); return; }

    setAdicionando(true);
    try {
      await adicionarFonteEExecutar(user.id, platform, username, link);
      toast("Conta adicionada — sincronização entra na fila");
      setNovoLink("");
      setAdicionarAberto(false);
      await carregar();
    } catch {
      toast("Erro ao adicionar conta");
    } finally {
      setAdicionando(false);
    }
  }

  async function sincronizar(fonte: Fonte) {
    if (!user) return;
    setSincronizandoId(fonte.id);
    try {
      await sincronizarFonte(user.id, fonte.id);
      toast(`Sincronização de @${fonte.username} entrou na fila`);
      await carregar();
    } catch {
      toast("Erro ao sincronizar");
    } finally {
      setSincronizandoId(null);
    }
  }

  const fonteAberta = fonteAbertaId ? fontes.find((f) => f.id === fonteAbertaId) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Contas</h1>
          <p className="text-xs text-neutral-600">Perfis que você acompanha — sincronize pra trazer conteúdo novo pra Memes.</p>
        </div>
        <div className="relative">
          <button onClick={() => setAdicionarAberto((v) => !v)} className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-teal-500 px-3 text-xs font-medium text-neutral-950 hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Adicionar conta
          </button>
          {adicionarAberto && (
            <div className="absolute right-0 top-9 z-10 w-80 rounded-md border border-neutral-800 bg-neutral-950 p-3 shadow-xl">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-neutral-600">Link do perfil (TikTok ou X)</p>
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={novoLink}
                  onChange={(e) => setNovoLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionar(); if (e.key === "Escape") setAdicionarAberto(false); }}
                  placeholder="https://www.tiktok.com/@perfil"
                  className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none"
                />
                <button onClick={() => setAdicionarAberto(false)} className="text-neutral-600 hover:text-neutral-300"><X className="h-3.5 w-3.5" /></button>
              </div>
              <button
                onClick={adicionar}
                disabled={!novoLink.trim() || adicionando}
                className="mt-2 flex min-h-[34px] w-full items-center justify-center rounded-md bg-teal-500 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
              >
                {adicionando ? "Adicionando..." : "Adicionar"}
              </button>
              <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">
                X hoje só importa post individual (colando o link do post direto em Memes) — perfil inteiro do X ainda não está disponível.
              </p>
            </div>
          )}
        </div>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : fontes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-neutral-600">
          <Rss className="h-6 w-6" />
          <span className="text-sm">Nenhuma conta ainda</span>
          <span className="text-xs text-teal-500">+ Adicionar conta</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fontes.map((f) => {
            const execucoes = execucoesPorFonte[f.id] ?? [];
            const execucaoAtiva = execucoes.find((e) => e.status === "pending" || e.status === "discovering" || e.status === "processing");
            return (
              <button
                key={f.id}
                onClick={() => setFonteAbertaId(f.id)}
                className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 text-left hover:border-teal-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-neutral-100">@{f.username}</p>
                  <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{ROTULO_PLATAFORMA[f.platform] ?? f.platform}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  {f.totalImportado} meme{f.totalImportado === 1 ? "" : "s"} · última sincronização {formatarData(f.ultimaSincronizacao)}
                </p>
                {execucaoAtiva ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-teal-400">
                    <RefreshCw className="h-3 w-3 animate-spin" /> {execucaoAtiva.status === "processing" ? `sincronizando… ${execucaoAtiva.totalDownloaded}/${execucaoAtiva.totalNew}` : "na fila"}
                  </span>
                ) : (
                  <span
                    onClick={(e) => { e.stopPropagation(); sincronizar(f); }}
                    className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-teal-300"
                  >
                    {sincronizandoId === f.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sincronizar agora
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {fonteAberta && (
        <ContaDrawer
          fonte={fonteAberta}
          onFechar={() => setFonteAbertaId(null)}
          onMudou={carregar}
        />
      )}
    </div>
  );
}
