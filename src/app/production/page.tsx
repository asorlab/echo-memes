"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Inbox, FolderOpen, Trash2, Film, Upload, Link2 } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { enviarBruto } from "@/lib/production/storage";
import {
  listarBrutos, criarBruto, atualizarBruto, excluirBruto,
  listarProducaoProjetos, criarProducaoProjeto, associarBrutoAoProjeto,
} from "@/lib/production/data";
import type { Bruto, ProducaoProjeto, StatusBruto, StatusProjeto } from "@/lib/production/types";

const ROTULO_STATUS_BRUTO: Record<StatusBruto, string> = {
  novo: "Novo", em_projeto: "Em projeto", processando: "Processando", pronto: "Pronto", erro: "Erro",
};
const COR_STATUS_BRUTO: Record<StatusBruto, string> = {
  novo: "border-neutral-700 text-neutral-400", em_projeto: "border-sky-500/40 text-sky-300",
  processando: "border-amber-500/40 text-amber-300", pronto: "border-teal-500/40 text-teal-300", erro: "border-[#F0997B]/40 text-[#F0997B]",
};
const ROTULO_STATUS_PROJETO: Record<StatusProjeto, string> = {
  rascunho: "Rascunho", preparando: "Preparando", processando: "Processando", revisao: "Revisão",
  aprovado: "Aprovado", exportado: "Exportado", publicado: "Publicado",
};

const CHAVE_ABA_PRODUCTION = "echo-assets:production-aba";
function lerAbaSalva(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(CHAVE_ABA_PRODUCTION); } catch { return null; }
}
function salvarAba(valor: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CHAVE_ABA_PRODUCTION, valor); } catch { /* ignora */ }
}

export default function ProductionPage() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Aba: URL (?tab=) primeiro, localStorage como fallback pra quando se
  // chega em Production sem o parametro (ex.: voltando do OS/LIFE) — sem
  // isso sempre cai em Inbox.
  const [aba, setAbaInterno] = useState<"inbox" | "projetos">(() => {
    const doUrl = searchParams.get("tab");
    if (doUrl === "projetos" || doUrl === "inbox") return doUrl;
    const doStorage = lerAbaSalva();
    return doStorage === "projetos" ? "projetos" : "inbox";
  });
  const setAba = useCallback((novaAba: "inbox" | "projetos") => {
    setAbaInterno(novaAba);
    salvarAba(novaAba);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tab", novaAba);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);
  const [brutos, setBrutos] = useState<Bruto[]>([]);
  const [projetos, setProjetos] = useState<ProducaoProjeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const [b, p] = await Promise.all([listarBrutos(user.id), listarProducaoProjetos(user.id)]);
    setBrutos(b);
    setProjetos(p);
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarBrutoArquivo(arquivo: File) {
    if (!user) return;
    setEnviando(true);
    try {
      const { caminho, tamanhoBytes } = await enviarBruto(user.id, arquivo);
      await criarBruto(user.id, { nome: arquivo.name, arquivo_url: caminho, tamanho_bytes: tamanhoBytes, origem: "upload" });
      toast("Bruto adicionado");
      carregar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao enviar bruto");
    } finally {
      setEnviando(false);
    }
  }

  function alternarSelecao(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este bruto? O arquivo original some do Storage.")) return;
    await excluirBruto(id);
    carregar();
  }

  async function novoProjeto() {
    if (!user) return;
    const p = await criarProducaoProjeto(user.id, "Novo projeto");
    router.push(`/production/${p.id}`);
  }

  async function criarProjetoComSelecionados() {
    if (!user || selecionados.size === 0) return;
    const nomeBase = brutos.find((b) => selecionados.has(b.id))?.nome ?? "Novo projeto";
    const p = await criarProducaoProjeto(user.id, nomeBase.replace(/\.[^.]+$/, ""));
    await Promise.all(Array.from(selecionados).map((id) => associarBrutoAoProjeto(user.id, p.id, id)));
    setSelecionados(new Set());
    router.push(`/production/${p.id}`);
  }

  return (
    <div>
      <PageHeader titulo="Production" descricao="Material bruto, projetos de produção e o que sai deles" />

      <div className="mb-4 flex gap-1.5">
        <button onClick={() => setAba("inbox")} className={`flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-mono transition-colors ${aba === "inbox" ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
          <Inbox className="h-3.5 w-3.5" /> Inbox
        </button>
        <button onClick={() => setAba("projetos")} className={`flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-mono transition-colors ${aba === "projetos" ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
          <FolderOpen className="h-3.5 w-3.5" /> Projetos
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : aba === "inbox" ? (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">{selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : "Selecione um ou mais brutos pra associar a um projeto"}</p>
            <div className="flex gap-2">
              {selecionados.size > 0 && (
                <button onClick={criarProjetoComSelecionados} className="flex min-h-[40px] items-center gap-2 rounded-md border border-teal-500/30 px-3 text-xs text-teal-300 hover:bg-teal-500/10">
                  <Link2 className="h-3.5 w-3.5" /> Criar produção com selecionados
                </button>
              )}
              <button onClick={() => inputRef.current?.click()} disabled={enviando} className="flex min-h-[40px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50">
                <Upload className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar bruto"}
              </button>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) adicionarBrutoArquivo(f); e.target.value = ""; }} />
            </div>
          </div>
          {brutos.length === 0 ? (
            <EmptyState icone={Film} titulo="Nenhum bruto ainda" descricao="Adicione o vídeo cru antes de transformar em projeto." />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {brutos.map((b) => (
                <Card key={b.id} className={`p-3 ${selecionados.has(b.id) ? "border-teal-500/50" : ""}`}>
                  <div className="mb-2 flex items-start gap-2">
                    <input type="checkbox" checked={selecionados.has(b.id)} onChange={() => alternarSelecao(b.id)} className="mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-100">{b.nome}</p>
                      <p className="text-[11px] text-neutral-500">
                        {b.duracao_seg != null ? `${Math.round(b.duracao_seg / 60)}min` : "duração desconhecida"}
                        {b.tamanho_bytes != null && ` · ${Math.round(b.tamanho_bytes / 1024 / 1024)}MB`}
                        {b.origem && ` · ${b.origem}`}
                      </p>
                    </div>
                    <button onClick={() => excluir(b.id)} className="shrink-0 text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${COR_STATUS_BRUTO[b.status]}`}>{ROTULO_STATUS_BRUTO[b.status]}</span>
                  {b.status === "erro" && b.erro_mensagem && <p className="mt-1 text-[10px] text-[#F0997B]">{b.erro_mensagem}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={novoProjeto} className="flex min-h-[40px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
              <Plus className="h-4 w-4" /> Novo projeto
            </button>
          </div>
          {projetos.length === 0 ? (
            <EmptyState icone={FolderOpen} titulo="Nenhum projeto de produção ainda" descricao="Crie um projeto, ou selecione brutos na Inbox e crie a partir deles." />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projetos.map((p) => (
                <Card key={p.id} className="cursor-pointer p-3 hover:border-neutral-700" onClick={() => router.push(`/production/${p.id}`)}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">{p.titulo}</p>
                    <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">{ROTULO_STATUS_PROJETO[p.status]}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">{p.tipo ?? "-"}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
