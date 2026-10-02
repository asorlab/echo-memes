"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Users, X, Search, Trash2, Music2, PlayCircle } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import {
  listarCriadoresRadar, listarRefsAdicionadas, adicionarRefsDoRadar, removerRefDoEcho,
  type CriadorRadar, type RefAdicionada,
} from "@/lib/refs";

const ICONE_PLATAFORMA: Record<string, typeof Music2> = { tiktok: Music2, youtube: PlayCircle };

function Avatar({ url, nome }: { url: string | null; nome: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-400">
      {nome.replace(/^@/, "").slice(0, 2).toUpperCase()}
    </div>
  );
}

function Perfis({ perfis }: { perfis: CriadorRadar["perfis"] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {perfis.map((p) => {
        const Icone = ICONE_PLATAFORMA[p.plataforma] ?? Music2;
        return (
          <a
            key={`${p.plataforma}-${p.username}`}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-teal-300"
          >
            <Icone className="h-2.5 w-2.5" /> @{p.username}
          </a>
        );
      })}
    </div>
  );
}

function SeletorRadar({ disponiveis, adicionadosIds, onAdicionar, onFechar }: {
  disponiveis: CriadorRadar[]; adicionadosIds: Set<string>;
  onAdicionar: (ids: string[]) => Promise<void>; onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const filtrados = disponiveis.filter((c) => {
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return c.nome.toLowerCase().includes(alvo) || c.perfis.some((p) => p.username.toLowerCase().includes(alvo));
  });

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function confirmar() {
    if (selecionados.size === 0) return;
    setEnviando(true);
    try {
      await onAdicionar(Array.from(selecionados));
      onFechar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-100">Adicionar do Radar</p>
          <button onClick={onFechar} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar creator…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-600">Nada encontrado.</p>
          ) : (
            filtrados.map((c) => {
              const jaAdicionado = adicionadosIds.has(c.id);
              const marcado = selecionados.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => !jaAdicionado && alternar(c.id)}
                  disabled={jaAdicionado}
                  className={`flex w-full items-center gap-2.5 rounded-md border p-2 text-left ${
                    jaAdicionado ? "border-neutral-800 opacity-50" : marcado ? "border-teal-500/50 bg-teal-500/10" : "border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <Avatar url={c.avatarUrl} nome={c.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-200">{c.nome}</p>
                    <Perfis perfis={c.perfis} />
                  </div>
                  {jaAdicionado ? (
                    <span className="shrink-0 text-[10px] text-neutral-500">Adicionado</span>
                  ) : (
                    <div className={`h-4 w-4 shrink-0 rounded border ${marcado ? "border-teal-400 bg-teal-400" : "border-neutral-700"}`} />
                  )}
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={confirmar}
          disabled={selecionados.size === 0 || enviando}
          className="mt-3 flex min-h-[38px] w-full items-center justify-center rounded-md bg-teal-500 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
        >
          {enviando ? "Adicionando..." : selecionados.size > 0 ? `Adicionar ${selecionados.size}` : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

export default function RefsPage() {
  const { user } = useUser();
  const toast = useToast();
  const [refs, setRefs] = useState<RefAdicionada[]>([]);
  const [disponiveis, setDisponiveis] = useState<CriadorRadar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    const [refsData, radarData] = await Promise.all([listarRefsAdicionadas(user.id), listarCriadoresRadar(user.id)]);
    setRefs(refsData);
    setDisponiveis(radarData);
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionadosIds = useMemo(() => new Set(refs.map((r) => r.id)), [refs]);

  async function adicionar(ids: string[]) {
    if (!user) return;
    try {
      await adicionarRefsDoRadar(user.id, ids);
      toast(ids.length > 1 ? `${ids.length} refs adicionadas` : "Ref adicionada");
      carregar();
    } catch {
      toast("Erro ao adicionar");
    }
  }

  async function remover(ref: RefAdicionada) {
    if (!window.confirm(`Remover ${ref.nome} do ECHO? Continua intacto no Radar.`)) return;
    try {
      await removerRefDoEcho(ref.associacaoId);
      toast("Removido do ECHO");
      carregar();
    } catch {
      toast("Erro ao remover");
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Refs"
        descricao="Creators do Radar que você acompanha como referência."
        acao={
          <button onClick={() => setSeletorAberto(true)} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
            <Plus className="h-4 w-4" /> Adicionar do Radar
          </button>
        }
      />

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : refs.length === 0 ? (
        <EmptyState icone={Users} titulo="Nenhuma ref ainda" descricao="Adicione creators do Radar pra acompanhar aqui." />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {refs.map((r) => (
            <Card key={r.associacaoId} className="flex items-start gap-2.5 p-3">
              <Avatar url={r.avatarUrl} nome={r.nome} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-100">{r.nome}</p>
                <div className="mt-1"><Perfis perfis={r.perfis} /></div>
              </div>
              <button onClick={() => remover(r)} title="Remover do ECHO" className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-600 hover:bg-[#F0997B]/10 hover:text-[#F0997B]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {seletorAberto && (
        <SeletorRadar disponiveis={disponiveis} adicionadosIds={adicionadosIds} onAdicionar={adicionar} onFechar={() => setSeletorAberto(false)} />
      )}
    </div>
  );
}
