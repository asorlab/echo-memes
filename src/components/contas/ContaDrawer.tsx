"use client";

import { useCallback, useEffect, useState } from "react";
import { X, RotateCcw, CircleCheck, CircleX, Clock3, Loader2, SkipForward, RefreshCw } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import {
  listarItens, tentarItemNovamente, sincronizarFonte, type Fonte, type ItemImportado, type StatusItem,
} from "@/lib/contas";

const ROTULO_STATUS: Record<StatusItem, string> = {
  pending: "Na fila",
  downloading: "Baixando",
  completed: "Importado",
  failed: "Falhou",
  skipped: "Já existia",
};

const ROTULO_ERRO: Record<string, string> = {
  privado_ou_embed_desabilitado: "Perfil privado ou com incorporação desabilitada",
  bloqueio_anti_bot: "Bloqueado por proteção anti-robô da plataforma",
  autenticacao_necessaria: "A plataforma pediu login pra acessar esse conteúdo",
  nao_encontrado: "Vídeo ou perfil não encontrado (removido ou @ mudou)",
  erro_extrator: "Falha técnica ao ler esse vídeo (formato não suportado)",
  worker_interrompido: "O processo foi interrompido antes de terminar",
  desconhecido: "Falha não identificada",
};

function StatusIcon({ status }: { status: StatusItem }) {
  if (status === "downloading") return <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />;
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5 text-teal-400" />;
  if (status === "failed") return <CircleX className="h-3.5 w-3.5 text-[#F0997B]" />;
  if (status === "skipped") return <SkipForward className="h-3.5 w-3.5 text-neutral-500" />;
  return <Clock3 className="h-3.5 w-3.5 text-neutral-500" />;
}

export default function ContaDrawer({ fonte, onFechar, onMudou }: { fonte: Fonte; onFechar: () => void; onMudou: () => void }) {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<ItemImportado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | StatusItem>("todos");
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const [tentandoId, setTentandoId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("50");
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const lista = await listarItens(fonte.id);
    setItens(lista);
    setCarregando(false);
  }, [fonte.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function sincronizarComQuantidade() {
    if (!user) return;
    const numero = Number(quantidade);
    if (!Number.isInteger(numero) || numero <= 0) { toast("Digite um número inteiro maior que zero"); return; }
    setSincronizando(true);
    try {
      await sincronizarFonte(user.id, fonte.id, numero);
      toast(`Importando até ${numero} vídeo(s) novo(s) — acompanhe abaixo`);
      onMudou();
    } catch {
      toast("Erro ao sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  async function tentarNovamente(item: ItemImportado) {
    if (!user) return;
    setTentandoId(item.id);
    try {
      await tentarItemNovamente(user.id, item.id, fonte.id);
      toast("Reenviado pra fila");
      await carregar();
      onMudou();
    } catch {
      toast("Erro ao tentar novamente");
    } finally {
      setTentandoId(null);
    }
  }

  const contagens = {
    todos: itens.length,
    completed: itens.filter((i) => i.status === "completed").length,
    failed: itens.filter((i) => i.status === "failed").length,
    skipped: itens.filter((i) => i.status === "skipped").length,
    pending: itens.filter((i) => i.status === "pending" || i.status === "downloading").length,
  };
  const itensFiltrados = filtro === "todos" ? itens : itens.filter((i) => i.status === filtro);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <p className="text-lg font-semibold text-neutral-100">{fonte.tipo === "hashtag" ? "#" : "@"}{fonte.username}</p>
            <p className="text-xs text-neutral-600">{contagens.completed} importados · {contagens.failed} falharam · {contagens.skipped} já existiam</p>
          </div>
          <button onClick={onFechar} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
        </div>

        {fonte.tipo === "profile" && (
          <div className="flex items-center gap-2 border-b border-neutral-800 px-5 py-3">
            <div className="flex-1">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Quantidade de vídeos</p>
              <input
                type="number"
                min={1}
                step={1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 outline-none"
              />
            </div>
            <button
              onClick={sincronizarComQuantidade}
              disabled={sincronizando}
              className="flex min-h-[36px] shrink-0 items-center gap-1.5 self-end rounded-md bg-teal-500 px-3 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`} /> {sincronizando ? "Importando..." : "Importar"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-800 px-5 py-3">
          {([["todos", "Todos"], ["completed", "Importados"], ["failed", "Falharam"], ["skipped", "Já existiam"], ["pending", "Em andamento"]] as const).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${filtro === id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
            >
              {rotulo} {id !== "todos" && `(${contagens[id]})`}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
          {carregando ? (
            <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
          ) : itensFiltrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-600">Nada aqui ainda.</p>
          ) : (
            itensFiltrados.map((item) => (
              <div key={item.id} className="rounded-md border border-neutral-800 bg-neutral-900/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <StatusIcon status={item.status} />
                    <p className="truncate text-xs text-neutral-300">{item.caption?.slice(0, 60) || item.externalId}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-neutral-600">{ROTULO_STATUS[item.status]}</span>
                    {item.status === "failed" && (
                      <button
                        onClick={() => tentarNovamente(item)}
                        disabled={tentandoId === item.id}
                        title="Tentar novamente"
                        className="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-teal-500/10 hover:text-teal-400 disabled:opacity-40"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {item.status === "failed" && item.errorMessage && (
                  <div className="mt-1.5">
                    <p className="text-[10px] text-[#F0997B]">{ROTULO_ERRO[item.errorCategory ?? "desconhecido"] ?? ROTULO_ERRO.desconhecido}</p>
                    <button onClick={() => setDetalheAbertoId(detalheAbertoId === item.id ? null : item.id)} className="mt-0.5 text-[10px] text-neutral-600 hover:text-neutral-400">
                      {detalheAbertoId === item.id ? "Ocultar detalhe técnico" : "Ver detalhe técnico"}
                    </button>
                    {detalheAbertoId === item.id && (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-neutral-950 p-2 text-[10px] leading-relaxed text-neutral-600">{item.errorMessage}</pre>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
