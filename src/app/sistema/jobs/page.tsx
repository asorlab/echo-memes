"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, RotateCcw, XCircle, ChevronDown, Activity } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import { faltaMigration } from "@/lib/lixeiraConfig";
import { ROTULO_STATUS_JOB, ROTULO_TIPO_JOB, STATUS_JOB } from "@/lib/production/rotulos";
import { listarJobsRecentes, listarLogsDoJob, listarWorkers, tentarJobDeNovo, cancelarJob, listarBrutos } from "@/lib/production/data";
import { estadoDoWorker, textoDesde } from "@/lib/production/worker";
import type { JobLog, ProducaoJob, WorkerStatus } from "@/lib/production/types";

const COR: Record<string, string> = {
  queued: "text-neutral-300", processing: "text-amber-300", completed: "text-teal-300", failed: "text-[#F0997B]", cancelled: "text-neutral-500",
};

export default function JobsPage() {
  const { user } = useUser();
  const toast = useToast();
  const [jobs, setJobs] = useState<ProducaoJob[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [semMigration, setSemMigration] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    try {
      const [j, w, b] = await Promise.all([listarJobsRecentes(user.id), listarWorkers(user.id), listarBrutos(user.id)]);
      setJobs(j); setWorkers(w);
      setNomes(Object.fromEntries(b.map((x) => [x.id, x.nome])));
      setSemMigration(false);
    } catch (e) {
      setSemMigration(faltaMigration((e as { message?: string })?.message));
    }
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); const t = setInterval(carregar, 10_000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { if (aberto) listarLogsDoJob(aberto).then(setLogs).catch(() => setLogs([])); }, [aberto, jobs]);

  const opcoes = useMemo(() => STATUS_JOB.map((s) => ({ id: s, rotulo: ROTULO_STATUS_JOB[s], contagem: jobs.filter((j) => j.status === s).length })).filter((o) => o.contagem > 0), [jobs]);
  const visiveis = jobs.filter((j) => !status || j.status === status);
  const worker = workers[0] ?? null;
  const estado = estadoDoWorker(worker?.visto_em ?? null, Date.now());

  async function deNovo(id: string) { try { await tentarJobDeNovo(id); toast("De volta para a fila"); carregar(); } catch { /* aviso do banco */ } }
  async function cancelar(id: string) { try { await cancelarJob(id); toast("Cancelado"); carregar(); } catch { /* aviso do banco */ } }

  if (carregando) return <p className="py-10 text-center text-sm text-neutral-500">Carregando...</p>;
  if (semMigration) return <EmptyState icone={Cpu} titulo="Fila ainda não ligada" descricao="Falta rodar a migration 0033 no Supabase." />;

  return (
    <div className="max-w-4xl">
      <PageHeader titulo="Jobs e worker" descricao="O que o worker do PC está fazendo, o que falhou e por quê." />

      <section className="mb-5 flex flex-wrap items-center gap-3 border-y border-neutral-800 py-3">
        <span className={`flex items-center gap-1.5 font-mono text-xs ${estado.ligado ? "text-teal-300" : "text-[#F0997B]"}`}>
          <Activity className="h-3.5 w-3.5" /> {estado.texto}
        </span>
        {worker && <span className="text-[11px] text-neutral-500">Pasta vigiada: <code className="text-neutral-400">{worker.pasta}</code></span>}
        {worker?.detalhe && "gpu" in worker.detalhe && <span className="text-[11px] text-neutral-500">{worker.detalhe.gpu ? "Proxy pela placa de vídeo" : "Proxy pelo processador"}</span>}
        {!worker && <span className="text-[11px] text-neutral-500">No PC, na pasta do echo-memes: <code className="text-neutral-400">npm run worker:producao</code></span>}
      </section>

      {jobs.length > 0 && <FilterBar opcoes={opcoes} ativo={status} onMudar={setStatus} />}

      {visiveis.length === 0 ? (
        <EmptyState icone={Cpu} titulo="Nenhum job" descricao="Os jobs aparecem aqui quando o worker encontra vídeo novo na pasta ou quando você pede para preparar de novo." />
      ) : (
        <ul className="divide-y divide-neutral-900 border-y border-neutral-800">
          {visiveis.map((j) => {
            const alvo = j.referencia_id ? nomes[j.referencia_id] : null;
            return (
              <li key={j.id}>
                <div className="flex items-center gap-3 py-2">
                  <button onClick={() => setAberto(aberto === j.id ? null : j.id)} aria-expanded={aberto === j.id} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${aberto === j.id ? "" : "-rotate-90"}`} />
                    <span className="w-28 shrink-0 font-mono text-[11px] text-neutral-400">{ROTULO_TIPO_JOB[j.tipo] ?? j.tipo}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{alvo ?? "(item removido)"}</span>
                    <span className={`shrink-0 font-mono text-[11px] ${COR[j.status]}`}>
                      {ROTULO_STATUS_JOB[j.status]}{j.status === "processing" && ` ${j.progresso}%`}
                    </span>
                    <span className="hidden w-24 shrink-0 text-right text-[10px] text-neutral-500 sm:block">{textoDesde(j.created_at, Date.now())}</span>
                  </button>
                  {j.status === "failed" && (
                    <button onClick={() => deNovo(j.id)} title="Tentar de novo" aria-label="Tentar de novo" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-teal-500/10 hover:text-teal-300"><RotateCcw className="h-3.5 w-3.5" /></button>
                  )}
                  {j.status === "queued" && (
                    <button onClick={() => cancelar(j.id)} title="Cancelar" aria-label="Cancelar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-[#F0997B1A] hover:text-[#F0997B]"><XCircle className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                {j.status === "processing" && <div className="mb-2 ml-7 h-1 overflow-hidden rounded bg-neutral-900"><div className="h-full bg-amber-400/70" style={{ width: `${j.progresso}%` }} /></div>}
                {aberto === j.id && (
                  <div className="mb-3 ml-7 space-y-1 rounded border border-neutral-800 bg-neutral-950 p-2 text-[11px]">
                    <p className="text-neutral-500">Tentativa {j.tentativas ?? 0} de {j.max_tentativas ?? 3}{j.worker_id ? ` · ${j.worker_id}` : ""}</p>
                    {j.erro_mensagem && <p className="text-[#F0997B]">{j.erro_mensagem}</p>}
                    {logs.length === 0 ? <p className="text-neutral-500">Sem registros ainda.</p> : logs.map((l) => (
                      <p key={l.id} className={l.nivel === "erro" ? "text-[#F0997B]" : l.nivel === "aviso" ? "text-amber-300" : "text-neutral-300"}>
                        <span className="font-mono text-neutral-500">{new Date(l.created_at).toLocaleTimeString("pt-BR")}</span> {l.mensagem}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
