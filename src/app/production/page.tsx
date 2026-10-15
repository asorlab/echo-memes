"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Inbox, FolderOpen, Trash2, Film, Upload, Link2 } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import BulkBar from "@/components/ui/BulkBar";
import ViewSwitcher, { useVisualizacao } from "@/components/ui/ViewSwitcher";
import { enviarBruto } from "@/lib/production/storage";
import {
  listarBrutos, criarBruto, excluirBruto,
  listarProducaoProjetos, criarProducaoProjeto, associarBrutoAoProjeto,
} from "@/lib/production/data";
import { ROTULO_STATUS_PROJETO, ROTULO_TIPO_PROJETO } from "@/lib/production/rotulos";
import { useMarca } from "@/components/marca/MarcaProvider";
import { SeloMarca } from "@/components/marca/SeletorMarca";
import { marcaDoRegistro } from "@/lib/marca";
import type { Bruto, ProducaoProjeto, StatusBruto } from "@/lib/production/types";

const ROTULO_STATUS_BRUTO: Record<StatusBruto, string> = {
  novo: "Novo", em_projeto: "Em projeto", processando: "Processando", pronto: "Pronto", erro: "Erro",
};
const COR_STATUS_BRUTO: Record<StatusBruto, string> = {
  novo: "border-neutral-700 text-neutral-400", em_projeto: "border-sky-500/40 text-sky-300",
  processando: "border-amber-500/40 text-amber-300", pronto: "border-teal-500/40 text-teal-300", erro: "border-[#F0997B]/40 text-[#F0997B]",
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
  const [visualizacao, setVisualizacao] = useVisualizacao("production-inbox", "grade");
  const { passa, campoNovo } = useMarca();
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

  // Vai para a Lixeira; o video so sai do Storage na exclusao definitiva de la.
  async function moverParaLixeira(ids: string[]) {
    if (ids.length === 0) return;
    const texto = ids.length === 1 ? "Mover este bruto para a Lixeira?" : `Mover ${ids.length} brutos para a Lixeira?`;
    if (!window.confirm(`${texto} O vídeo continua guardado até você excluir de vez na Lixeira.`)) return;
    let falha = 0;
    for (const id of ids) {
      try { await excluirBruto(id); } catch { falha++; }
    }
    if (falha < ids.length) toast(ids.length - falha === 1 ? "Bruto na Lixeira" : `${ids.length - falha} brutos na Lixeira`);
    setSelecionados(new Set());
    carregar();
  }

  async function novoProjeto() {
    if (!user) return;
    const p = await criarProducaoProjeto(user.id, "Novo projeto", campoNovo());
    router.push(`/production/${p.id}`);
  }

  async function criarProjetoComSelecionados() {
    if (!user || selecionados.size === 0) return;
    const nomeBase = brutos.find((b) => selecionados.has(b.id))?.nome ?? "Novo projeto";
    const p = await criarProducaoProjeto(user.id, nomeBase.replace(/\.[^.]+$/, ""), campoNovo());
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
            <p className="text-xs text-neutral-500">Selecione um ou mais brutos para criar uma produção</p>
            <div className="flex items-center gap-2">
              <ViewSwitcher valor={visualizacao} onMudar={setVisualizacao} />
              <button onClick={() => inputRef.current?.click()} disabled={enviando} className="flex min-h-[40px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50">
                <Upload className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar bruto"}
              </button>
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) adicionarBrutoArquivo(f); e.target.value = ""; }} />
            </div>
          </div>
          {brutos.length === 0 ? (
            <EmptyState icone={Film} titulo="Nenhum bruto ainda" descricao="Adicione o vídeo cru antes de transformar em projeto." />
          ) : (
            <div className={visualizacao === "grade" ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" : "space-y-1"}>
              {brutos.map((b) => (
                <Card key={b.id} className={`${visualizacao === "grade" ? "p-3" : "flex items-center gap-3 px-3 py-2"} ${selecionados.has(b.id) ? "border-teal-500/50" : ""}`}>
                  <div className={`flex min-w-0 flex-1 items-start gap-2 ${visualizacao === "grade" ? "mb-2" : ""}`}>
                    <input type="checkbox" checked={selecionados.has(b.id)} onChange={() => alternarSelecao(b.id)} aria-label={`Selecionar ${b.nome}`} className="mt-1 h-4 w-4 shrink-0 accent-teal-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-100">{b.nome}</p>
                      <p className="text-[11px] text-neutral-500">
                        {b.duracao_seg != null ? `${Math.round(b.duracao_seg / 60)} min` : "duração desconhecida"}
                        {b.tamanho_bytes != null && ` · ${Math.round(b.tamanho_bytes / 1024 / 1024)} MB`}
                        {b.origem && ` · ${b.origem}`}
                      </p>
                    </div>
                    {visualizacao === "grade" && (
                      <button onClick={() => moverParaLixeira([b.id])} title="Mover para a Lixeira" aria-label={`Mover ${b.nome} para a Lixeira`} className="shrink-0 text-neutral-500 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${COR_STATUS_BRUTO[b.status]}`}>{ROTULO_STATUS_BRUTO[b.status]}</span>
                  {visualizacao === "lista" && (
                    <button onClick={() => moverParaLixeira([b.id])} title="Mover para a Lixeira" aria-label={`Mover ${b.nome} para a Lixeira`} className="shrink-0 text-neutral-500 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                  {b.status === "erro" && b.erro_mensagem && <p className="mt-1 text-[10px] text-[#F0997B]">{b.erro_mensagem}</p>}
                </Card>
              ))}
            </div>
          )}
          <BulkBar quantidade={selecionados.size} total={brutos.length} onSelecionarTodos={() => setSelecionados(new Set(brutos.map((b) => b.id)))} onLimpar={() => setSelecionados(new Set())}>
            <button onClick={criarProjetoComSelecionados} className="flex min-h-[32px] items-center gap-1.5 rounded-md border border-teal-500/30 px-2.5 text-xs text-teal-300 hover:bg-teal-500/10">
              <Link2 className="h-3.5 w-3.5" /> Criar produção
            </button>
            <button onClick={() => moverParaLixeira(Array.from(selecionados))} className="flex min-h-[32px] items-center gap-1.5 rounded-md border border-[#F0997B]/40 px-2.5 text-xs text-[#F0997B] hover:bg-[#F0997B]/10">
              <Trash2 className="h-3.5 w-3.5" /> Lixeira
            </button>
          </BulkBar>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={novoProjeto} className="flex min-h-[40px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
              <Plus className="h-4 w-4" /> Novo projeto
            </button>
          </div>
          {projetos.filter((p) => passa(marcaDoRegistro(p.marca_slug))).length === 0 ? (
            <EmptyState icone={FolderOpen} titulo={projetos.length === 0 ? "Nenhum projeto de produção ainda" : "Nenhuma produção nesta marca"} descricao={projetos.length === 0 ? "Crie um projeto, ou selecione brutos na Inbox e crie a partir deles." : "Troque a marca no menu para ver as outras."} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projetos.filter((p) => passa(marcaDoRegistro(p.marca_slug))).map((p) => (
                <Card key={p.id} className="cursor-pointer p-3 hover:border-neutral-700" onClick={() => router.push(`/production/${p.id}`)}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">{p.titulo}</p>
                    <SeloMarca valor={marcaDoRegistro(p.marca_slug)} />
                    <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">{ROTULO_STATUS_PROJETO[p.status]}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">{p.tipo ? ROTULO_TIPO_PROJETO[p.tipo] : "-"}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
