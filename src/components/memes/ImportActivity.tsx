"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock3,
  Loader2,
  X,
} from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

type StatusRun = "pending" | "discovering" | "processing" | "completed" | "failed" | "cancelled";

interface ImportRunRow {
  id: string;
  source_id: string;
  status: StatusRun;
  total_found: number | null;
  total_new: number | null;
  total_downloaded: number | null;
  total_skipped: number | null;
  total_failed: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  import_sources: { username: string; platform: string } | null;
}

interface ImportActivityProps {
  userId: string;
  onImportCompleted?: () => void | Promise<void>;
}

const INTERVALO_ATUALIZACAO = 5000;
const ROTULO_PLATAFORMA: Record<string, string> = { tiktok: "TikTok", x: "X" };

function rotuloStatus(status: StatusRun) {
  if (status === "pending") return "Na fila";
  if (status === "discovering") return "Buscando vídeos";
  if (status === "processing") return "Importando";
  if (status === "completed") return "Concluído";
  if (status === "cancelled") return "Cancelada";
  return "Falhou";
}

function StatusIcon({ status }: { status: StatusRun }) {
  if (status === "discovering" || status === "processing") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />;
  }
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5 text-teal-400" />;
  if (status === "failed") return <CircleX className="h-3.5 w-3.5 text-[#F0997B]" />;
  if (status === "cancelled") return <CircleX className="h-3.5 w-3.5 text-neutral-500" />;
  return <Clock3 className="h-3.5 w-3.5 text-neutral-500" />;
}

export default function ImportActivity({ userId, onImportCompleted }: ImportActivityProps) {
  const [execucoes, setExecucoes] = useState<ImportRunRow[]>([]);
  const [aberto, setAberto] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);

  const primeiraLeitura = useRef(true);
  const statusAnterior = useRef<Record<string, StatusRun>>({});

  const carregar = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from("import_runs")
      .select("id, source_id, status, total_found, total_new, total_downloaded, total_skipped, total_failed, error_message, created_at, updated_at, import_sources(username, platform)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erro ao carregar importações:", error);
      setCarregando(false);
      return;
    }

    const novas = ((data ?? []) as unknown) as ImportRunRow[];

    if (!primeiraLeitura.current) {
      const acabouAgora = novas.some(
        (execucao) =>
          execucao.status === "completed" &&
          statusAnterior.current[execucao.id] &&
          statusAnterior.current[execucao.id] !== "completed",
      );
      if (acabouAgora) await onImportCompleted?.();
    }

    statusAnterior.current = Object.fromEntries(novas.map((execucao) => [execucao.id, execucao.status]));
    primeiraLeitura.current = false;

    setExecucoes(novas);
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
        .from("import_runs")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "discovering", "processing"])
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

  async function cancelarExecucao(execucao: ImportRunRow) {
    if (execucao.status !== "pending" && execucao.status !== "discovering" && execucao.status !== "processing") return;
    setAcaoEmAndamento(`cancelar-${execucao.id}`);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("import_runs")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", execucao.id)
        .eq("user_id", userId)
        .in("status", ["pending", "discovering", "processing"]);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error("Erro ao cancelar importação:", error);
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  async function limparExecucao(execucao: ImportRunRow) {
    if (execucao.status === "pending" || execucao.status === "discovering" || execucao.status === "processing") return;
    setAcaoEmAndamento(`limpar-${execucao.id}`);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("import_runs").delete().eq("id", execucao.id).eq("user_id", userId);
      if (error) throw error;
      setExecucoes((atuais) => atuais.filter((item) => item.id !== execucao.id));
      delete statusAnterior.current[execucao.id];
      if (detalheErro === execucao.id) setDetalheErro(null);
    } catch (error) {
      console.error("Erro ao limpar importação:", error);
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  async function limparConcluidas() {
    const ids = execucoes.filter((e) => e.status === "completed").map((e) => e.id);
    if (ids.length === 0) return;
    setAcaoEmAndamento("limpar-concluidas");
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("import_runs").delete().eq("user_id", userId).in("id", ids).eq("status", "completed");
      if (error) throw error;
      setExecucoes((atuais) => atuais.filter((e) => e.status !== "completed"));
      for (const id of ids) delete statusAnterior.current[id];
    } catch (error) {
      console.error("Erro ao limpar importações concluídas:", error);
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  if (carregando || execucoes.length === 0) return null;

  const ativas = execucoes.filter((e) => e.status === "pending" || e.status === "discovering" || e.status === "processing").length;
  const concluidas = execucoes.filter((e) => e.status === "completed").length;
  const falhas = execucoes.filter((e) => e.status === "failed").length;

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-neutral-800/80 bg-neutral-950/40">
      <div className="flex min-h-[40px] items-center justify-between gap-3 px-3">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="text-xs font-medium text-neutral-300">Importações</span>
          {ativas > 0 && <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">{ativas} {ativas === 1 ? "ativa" : "ativas"}</span>}
          {ativas === 0 && falhas > 0 && <span className="rounded-full bg-[#F0997B]/10 px-2 py-0.5 text-[10px] text-[#F0997B]">{falhas} {falhas === 1 ? "falha" : "falhas"}</span>}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {aberto && concluidas > 0 && (
            <button type="button" onClick={limparConcluidas} disabled={acaoEmAndamento !== null} className="text-[10px] text-neutral-500 transition hover:text-neutral-300 disabled:opacity-40">
              {acaoEmAndamento === "limpar-concluidas" ? "Limpando..." : "Limpar concluídas"}
            </button>
          )}
          <button type="button" onClick={() => setAberto((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-neutral-900" aria-label={aberto ? "Fechar importações" : "Abrir importações"}>
            {aberto ? <ChevronUp className="h-3.5 w-3.5 text-neutral-600" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-600" />}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="divide-y divide-neutral-900 border-t border-neutral-900">
          {execucoes.map((execucao) => {
            const baixados = execucao.total_downloaded ?? 0;
            const ignorados = execucao.total_skipped ?? 0;
            const falhados = execucao.total_failed ?? 0;
            const novos = execucao.total_new ?? 0;
            const processados = baixados + ignorados + falhados;
            const percentual = novos > 0 ? Math.min(100, Math.round((processados / novos) * 100)) : 0;
            const ativa = execucao.status === "pending" || execucao.status === "discovering" || execucao.status === "processing";
            const mostrarProgresso = novos > 0 && (execucao.status === "processing" || execucao.status === "completed" || execucao.status === "cancelled");
            const cancelando = acaoEmAndamento === `cancelar-${execucao.id}`;
            const limpando = acaoEmAndamento === `limpar-${execucao.id}`;

            return (
              <div key={execucao.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-300">@{execucao.import_sources?.username ?? "?"}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-600">{ROTULO_PLATAFORMA[execucao.import_sources?.platform ?? ""] ?? "Importação"}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 text-[11px] text-neutral-400">
                        <StatusIcon status={execucao.status} />
                        <span>{rotuloStatus(execucao.status)}</span>
                      </div>
                      {mostrarProgresso && (
                        <p className="mt-0.5 text-[10px] tabular-nums text-neutral-600">{baixados} novo(s) · {ignorados} já existia(m) · {falhados} falhou/falharam</p>
                      )}
                    </div>
                    {ativa ? (
                      <button type="button" onClick={() => cancelarExecucao(execucao)} disabled={acaoEmAndamento !== null} className="mt-0.5 text-[10px] text-neutral-600 transition hover:text-[#F0997B] disabled:opacity-40">
                        {cancelando ? "Cancelando..." : "Cancelar"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => limparExecucao(execucao)} disabled={acaoEmAndamento !== null} className="flex h-5 w-5 items-center justify-center rounded text-neutral-700 transition hover:bg-neutral-900 hover:text-neutral-400 disabled:opacity-40" aria-label="Limpar do histórico" title="Limpar do histórico">
                        {limpando ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {mostrarProgresso && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-900">
                    <div className="h-full rounded-full bg-teal-500/70 transition-all" style={{ width: `${percentual}%` }} />
                  </div>
                )}

                {execucao.status === "failed" && execucao.error_message && (
                  <div className="mt-1.5">
                    <button type="button" onClick={() => setDetalheErro((id) => (id === execucao.id ? null : execucao.id))} className="text-[10px] text-neutral-500 hover:text-neutral-300">
                      {detalheErro === execucao.id ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                    {detalheErro === execucao.id && (
                      <p className="mt-1 max-h-24 overflow-auto rounded bg-neutral-900/70 p-2 text-[10px] leading-relaxed text-neutral-500">{execucao.error_message}</p>
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
