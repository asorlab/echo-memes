"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, X } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { listarProjetos, criarProjeto, type Projeto, type TipoConteudo } from "@/lib/projetos";

const TIPOS: { id: TipoConteudo; rotulo: string }[] = [
  { id: "vlog", rotulo: "Vlog" }, { id: "grwm", rotulo: "GRWM" }, { id: "gaming", rotulo: "Gaming" },
  { id: "asmr", rotulo: "ASMR" }, { id: "cover", rotulo: "Cover" }, { id: "lifestyle", rotulo: "Lifestyle" }, { id: "outro", rotulo: "Outro" },
];
const ROTULO_STATUS: Record<string, string> = { planejamento: "Planejamento", em_andamento: "Em andamento", concluido: "Concluído", arquivado: "Arquivado" };

export default function ProjetosPage() {
  const { user } = useUser();
  const router = useRouter();
  const toast = useToast();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoConteudo | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    const lista = await listarProjetos(user.id);
    setProjetos(lista);
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar() {
    if (!user || !novoNome.trim()) return;
    setCriando(true);
    try {
      const projeto = await criarProjeto(user.id, novoNome.trim(), novoTipo);
      setNovoNome(""); setNovoTipo(null); setNovoAberto(false);
      router.push(`/projetos/${projeto.id}`);
    } catch {
      toast("Erro ao criar projeto");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Projetos"
        descricao="Conteúdos que você vai produzir, referências, assets planejados e assets usados, tudo num só lugar."
        acao={
          <button onClick={() => setNovoAberto(true)} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo projeto
          </button>
        }
      />

      {novoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-100">Novo projeto</p>
              <button onClick={() => setNovoAberto(false)} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
            </div>
            <input
              autoFocus
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") criar(); }}
              placeholder="Ex.: Vlog Praia"
              className="mb-2 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-600">Tipo de conteúdo</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button key={t.id} onClick={() => setNovoTipo(t.id === novoTipo ? null : t.id)} className={`rounded-full border px-2.5 py-1 text-[11px] ${novoTipo === t.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{t.rotulo}</button>
              ))}
            </div>
            <button onClick={criar} disabled={!novoNome.trim() || criando} className="flex min-h-[38px] w-full items-center justify-center rounded-md bg-teal-500 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40">
              {criando ? "Criando..." : "Criar projeto"}
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : projetos.length === 0 ? (
        <EmptyState icone={FolderKanban} titulo="Nenhum projeto ainda" descricao="Crie um projeto pra organizar referências e assets de um conteúdo específico." />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((p) => (
            <Card key={p.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => router.push(`/projetos/${p.id}`)}>
              <p className="mb-1 truncate text-sm font-medium text-neutral-100">{p.nome}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {p.tipoConteudo && <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-teal-300">{TIPOS.find((t) => t.id === p.tipoConteudo)?.rotulo}</span>}
                <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-neutral-400">{ROTULO_STATUS[p.status] ?? p.status}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
