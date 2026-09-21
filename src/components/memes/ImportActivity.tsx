"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, Clock3, Loader2 } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

type ImportStatus = "pending" | "processing" | "completed" | "failed";

interface ImportQueueRow {
  id: string;
  source_url: string;
  source_type: string;
  categoria: string | null;
  status: ImportStatus;
  total_items: number | null;
  processed_items: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportActivityProps {
  userId: string;
  onImportCompleted?: () => void | Promise<void>;
}

const INTERVALO_ATUALIZACAO = 5000;

function nomeDaFonte(url: string) {
  try {
    const parsed = new URL(url);
    const tiktok = parsed.pathname.match(/^\/@([^/]+)/i);
    if (parsed.hostname.includes("tiktok.com") && tiktok?.[1]) {
      return `@${decodeURIComponent(tiktok[1])}`;
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.length > 38 ? `${url.slice(0, 35)}...` : url;
  }
}

function plataformaDaFonte(url: string) {
  if (url.toLowerCase().includes("tiktok.com")) return "TikTok";
  if (/\b(x\.com|twitter\.com)\b/i.test(url)) return "X";
  return "Importação";
}

function rotuloStatus(status: ImportStatus) {
  if (status === "pending") return "Na fila";
  if (status === "processing") return "Importando";
  if (status === "completed") return "Concluído";
  return "Falhou";
}

function StatusIcon({ status }: { status: ImportStatus }) {
  if (status === "processing") return <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />;
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5 text-teal-400" />;
  if (status === "failed") return <CircleX className="h-3.5 w-3.5 text-[#F0997B]" />;
  return <Clock3 className="h-3.5 w-3.5 text-neutral-500" />;
}

export default function ImportActivity({ userId, onImportCompleted }: ImportActivityProps) {
  const [tarefas, setTarefas] = useState<ImportQueueRow[]>([]);
  const [aberto, setAberto] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const primeiraLeitura = useRef(true);
  const statusAnterior = useRef<Record<string, ImportStatus>>({});

  const carregar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from("meme_import_queue")
      .select("id, source_url, source_type, categoria, status, total_items, processed_items, error_message, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Erro ao carregar importações:", error);
      setCarregando(false);
      return;
    }

    const novas = (data ?? []) as ImportQueueRow[];

    if (!primeiraLeitura.current) {
      const acabouAgora = novas.some(
        (tarefa) =>
          tarefa.status === "completed" &&
          statusAnterior.current[tarefa.id] &&
          statusAnterior.current[tarefa.id] !== "completed",
      );

      if (acabouAgora) await onImportCompleted?.();
    }

    statusAnterior.current = Object.fromEntries(novas.map((tarefa) => [tarefa.id, tarefa.status]));
    primeiraLeitura.current = false;
    setTarefas(novas);
    setCarregando(false);
  }, [onImportCompleted, userId]);

  useEffect(() => {
    let cancelado = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function atualizar() {
      if (cancelado) return;
      await carregar();
      if (cancelado) return;

      const supabase = supabaseBrowser();
      const { data } = await supabase
        .from("meme_import_queue")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "processing"])
        .limit(1);

      if (!cancelado && data && data.length > 0) {
        timeout = setTimeout(atualizar, INTERVALO_ATUALIZACAO);
      }
    }

    atualizar();

    return () => {
      cancelado = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [carregar, userId]);

  if (carregando || tarefas.length === 0) return null;

  const ativas = tarefas.filter((tarefa) => tarefa.status === "pending" || tarefa.status === "processing").length;
  const falhas = tarefas.filter((tarefa) => tarefa.status === "failed").length;

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-neutral-800/80 bg-neutral-950/40">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="flex min-h-[40px] w-full items-center justify-between gap-3 px-3 text-left hover:bg-neutral-900/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-neutral-300">Importações</span>
          {ativas > 0 && (
            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">
              {ativas} {ativas === 1 ? "ativa" : "ativas"}
            </span>
          )}
          {ativas === 0 && falhas > 0 && (
            <span className="rounded-full bg-[#F0997B]/10 px-2 py-0.5 text-[10px] text-[#F0997B]">
              {falhas} {falhas === 1 ? "falha" : "falhas"}
            </span>
          )}
        </div>
        {aberto ? <ChevronUp className="h-3.5 w-3.5 text-neutral-600" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-600" />}
      </button>

      {aberto && (
        <div className="divide-y divide-neutral-900 border-t border-neutral-900">
          {tarefas.map((tarefa) => {
            const processados = tarefa.processed_items ?? 0;
            const total = tarefa.total_items ?? 0;
            const percentual = total > 0 ? Math.min(100, Math.round((processados / total) * 100)) : 0;
            const mostrarProgresso = total > 0 && (tarefa.status === "processing" || tarefa.status === "completed");

            return (
              <div key={tarefa.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-300">{nomeDaFonte(tarefa.source_url)}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-600">{plataformaDaFonte(tarefa.source_url)}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-[11px] text-neutral-400">
                      <StatusIcon status={tarefa.status} />
                      <span>{rotuloStatus(tarefa.status)}</span>
                    </div>
                    {mostrarProgresso && (
                      <p className="mt-0.5 text-[10px] tabular-nums text-neutral-600">
                        {processados} de {total}
                      </p>
                    )}
                  </div>
                </div>

                {mostrarProgresso && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-900">
                    <div className="h-full rounded-full bg-teal-500/70 transition-all" style={{ width: `${percentual}%` }} />
                  </div>
                )}

                {tarefa.status === "failed" && tarefa.error_message && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => setDetalheErro((id) => (id === tarefa.id ? null : tarefa.id))}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      {detalheErro === tarefa.id ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                    {detalheErro === tarefa.id && (
                      <p className="mt-1 max-h-24 overflow-auto rounded bg-neutral-900/70 p-2 text-[10px] leading-relaxed text-neutral-500">
                        {tarefa.error_message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
