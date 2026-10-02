"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Compass, Layers, CheckCircle2, Plus, X, Trash2, ArrowRightLeft, Search } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import EditableField from "@/components/ui/EditableField";
import Card from "@/components/ui/Card";
import {
  listarItensProjeto, adicionarItemProjeto, atualizarPapelItem, removerItemProjeto,
  buscarNaBiblioteca, atualizarProjeto, excluirProjeto, listarProjetos,
  type ItemProjeto, type ItemBiblioteca, type Projeto, type PapelItem, type TipoConteudo, type StatusProjeto,
} from "@/lib/projetos";

const TIPOS: { id: TipoConteudo; rotulo: string }[] = [
  { id: "vlog", rotulo: "Vlog" }, { id: "grwm", rotulo: "GRWM" }, { id: "gaming", rotulo: "Gaming" },
  { id: "asmr", rotulo: "ASMR" }, { id: "cover", rotulo: "Cover" }, { id: "lifestyle", rotulo: "Lifestyle" }, { id: "outro", rotulo: "Outro" },
];
const STATUS_OPCOES: { id: StatusProjeto; rotulo: string }[] = [
  { id: "planejamento", rotulo: "Planejamento" }, { id: "em_andamento", rotulo: "Em andamento" }, { id: "concluido", rotulo: "Concluído" }, { id: "arquivado", rotulo: "Arquivado" },
];

function ItemCard({ item, acoes }: { item: ItemProjeto; acoes: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-2.5 p-2.5">
      {item.urlAssinada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.urlAssinada} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-neutral-800 text-[9px] text-neutral-500">{item.rotuloTabela[0]}</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-neutral-200">{item.titulo}</p>
        <p className="text-[10px] text-neutral-600">{item.rotuloTabela}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">{acoes}</div>
    </Card>
  );
}

function SeletorBiblioteca({ escopo, onEscolher, onFechar }: { escopo: "asset" | "referencia"; onEscolher: (item: ItemBiblioteca) => void; onFechar: () => void }) {
  const { user } = useUser();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ItemBiblioteca[]>([]);
  const [buscando, setBuscando] = useState(true);

  const buscar = useCallback(async (t: string) => {
    if (!user) return;
    setBuscando(true);
    const r = await buscarNaBiblioteca(user.id, t, escopo);
    setResultados(r);
    setBuscando(false);
  }, [user, escopo]);

  useEffect(() => { buscar(""); }, [buscar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-100">{escopo === "asset" ? "Adicionar asset" : "Adicionar referência"}</p>
          <button onClick={onFechar} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscar(termo); }}
            placeholder="Buscar em toda a biblioteca…"
            className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
          />
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {buscando ? (
            <p className="py-6 text-center text-xs text-neutral-600">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-600">Nada encontrado.</p>
          ) : (
            resultados.map((r) => (
              <button key={`${r.tabelaOrigem}:${r.id}`} onClick={() => onEscolher(r)} className="flex w-full items-center gap-2.5 rounded-md border border-neutral-800 bg-neutral-900/60 p-2 text-left hover:border-teal-500/30">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-200">{r.titulo}</p>
                  <p className="text-[10px] text-neutral-600">{r.rotuloTabela}</p>
                </div>
                <Plus className="h-3.5 w-3.5 shrink-0 text-teal-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjetoDetalhePage() {
  const params = useParams();
  const projetoId = params.id as string;
  const { user } = useUser();
  const router = useRouter();
  const toast = useToast();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [itens, setItens] = useState<ItemProjeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [seletorAberto, setSeletorAberto] = useState<PapelItem | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const [projetos, itensProjeto] = await Promise.all([listarProjetos(user.id), listarItensProjeto(projetoId)]);
    setProjeto(projetos.find((p) => p.id === projetoId) ?? null);
    setItens(itensProjeto);
    setCarregando(false);
  }, [user, projetoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(patch: Parameters<typeof atualizarProjeto>[1]) {
    await atualizarProjeto(projetoId, patch);
    carregar();
  }

  async function escolherItem(papel: PapelItem, item: ItemBiblioteca) {
    if (!user) return;
    try {
      await adicionarItemProjeto(user.id, projetoId, papel, item);
      toast("Adicionado ao projeto");
      setSeletorAberto(null);
      carregar();
    } catch {
      toast("Erro ao adicionar");
    }
  }

  async function mudarPapel(item: ItemProjeto, papel: PapelItem) {
    await atualizarPapelItem(item.itemProjetoId, papel);
    carregar();
  }
  async function remover(item: ItemProjeto) {
    await removerItemProjeto(item.itemProjetoId);
    toast("Removido do projeto");
    carregar();
  }
  async function excluir() {
    if (!window.confirm(`Excluir o projeto "${projeto?.nome}"? Os assets/referências continuam na sua biblioteca.`)) return;
    await excluirProjeto(projetoId);
    toast("Projeto excluído");
    router.push("/projetos");
  }

  if (carregando || !projeto) return <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>;

  const referencias = itens.filter((i) => i.papel === "referencia");
  const planejados = itens.filter((i) => i.papel === "planejado");
  const usados = itens.filter((i) => i.papel === "usado");

  return (
    <div>
      <button onClick={() => router.push("/projetos")} className="mb-3 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Projetos
      </button>

      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <EditableField value={projeto.nome} onSave={(v) => salvar({ nome: v })} displayClassName="text-lg font-semibold text-neutral-100" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button key={t.id} onClick={() => salvar({ tipo_conteudo: t.id === projeto.tipoConteudo ? null : t.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${projeto.tipoConteudo === t.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{t.rotulo}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STATUS_OPCOES.map((s) => (
            <button key={s.id} onClick={() => salvar({ status: s.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${projeto.status === s.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{s.rotulo}</button>
          ))}
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Observações</p>
          <EditableField as="textarea" value={projeto.observacoes ?? ""} placeholder="Notas do projeto..." onSave={(v) => salvar({ observacoes: v || null })} displayClassName="text-sm text-neutral-300" />
        </div>
        <button onClick={excluir} className="mt-3 flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
          <Trash2 className="h-3.5 w-3.5" /> Excluir projeto
        </button>
      </div>

      <Secao titulo="Referências" icone={Compass} itens={referencias} papel="referencia" onAdicionar={() => setSeletorAberto("referencia")} onRemover={remover} />
      <Secao titulo="Assets planejados" icone={Layers} itens={planejados} papel="planejado" onAdicionar={() => setSeletorAberto("planejado")} onRemover={remover} onMudarPapel={(item) => mudarPapel(item, "usado")} rotuloMudarPapel="Marcar como usado" />
      <Secao titulo="Assets usados" icone={CheckCircle2} itens={usados} papel="usado" onAdicionar={() => setSeletorAberto("usado")} onRemover={remover} onMudarPapel={(item) => mudarPapel(item, "planejado")} rotuloMudarPapel="Voltar para planejado" />

      {seletorAberto && (
        <SeletorBiblioteca
          escopo={seletorAberto === "referencia" ? "referencia" : "asset"}
          onEscolher={(item) => escolherItem(seletorAberto, item)}
          onFechar={() => setSeletorAberto(null)}
        />
      )}
    </div>
  );
}

function Secao({ titulo, icone: Icone, itens, onAdicionar, onRemover, onMudarPapel, rotuloMudarPapel }: {
  titulo: string; icone: typeof Compass; itens: ItemProjeto[]; papel: PapelItem;
  onAdicionar: () => void; onRemover: (item: ItemProjeto) => void;
  onMudarPapel?: (item: ItemProjeto) => void; rotuloMudarPapel?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400"><Icone className="h-3.5 w-3.5" /> {titulo} <span className="text-neutral-600">({itens.length})</span></p>
        <button onClick={onAdicionar} className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300"><Plus className="h-3 w-3" /> Adicionar</button>
      </div>
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-800 py-4 text-center text-[11px] text-neutral-600">Nada aqui ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {itens.map((item) => (
            <ItemCard
              key={item.itemProjetoId}
              item={item}
              acoes={
                <>
                  {onMudarPapel && (
                    <button onClick={() => onMudarPapel(item)} title={rotuloMudarPapel} className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-teal-500/10 hover:text-teal-400">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => onRemover(item)} title="Remover do projeto" className="flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-[#F0997B]/10 hover:text-[#F0997B]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
