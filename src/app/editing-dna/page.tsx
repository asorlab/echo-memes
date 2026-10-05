"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Dna, Trash2, X } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import {
  listarDnas, criarDna, atualizarDna, excluirDna,
  listarRegras, adicionarRegra, excluirRegra,
  listarReferenciasDna, adicionarReferenciaAsset, adicionarReferenciaCriador, excluirReferenciaDna,
  obterAutoEdit, salvarAutoEdit,
} from "@/lib/production/data";
import { buscarNaBiblioteca, TABELAS_ASSET, type ItemBiblioteca } from "@/lib/projetos";
import { listarCriadoresRadar, type CriadorRadar } from "@/lib/refs";
import type { EditingDna, DnaRegra, DnaReferencia, DnaAutoEdit, CategoriaDnaRegra } from "@/lib/production/types";

const CATEGORIAS: CategoriaDnaRegra[] = ["ritmo", "jump_cuts", "silencio", "legendas", "zoom", "transicoes", "audio", "cor", "musica", "sfx"];

export default function EditingDnaPage() {
  const { user } = useUser();
  const toast = useToast();
  const [dnas, setDnas] = useState<EditingDna[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const d = await listarDnas(user.id);
    setDnas(d);
    setCarregando(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  async function novo() {
    if (!user) return;
    const d = await criarDna(user.id, "Novo DNA");
    setDnas((prev) => [d, ...prev]);
    setSelecionadoId(d.id);
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este Editing DNA? Projetos que usam ele ficam sem DNA vinculado.")) return;
    await excluirDna(id);
    if (selecionadoId === id) setSelecionadoId(null);
    toast("DNA excluído");
    carregar();
  }

  const selecionado = dnas.find((d) => d.id === selecionadoId) ?? null;

  return (
    <div>
      <PageHeader titulo="Editing DNA" descricao="Regras de edição reutilizáveis, como cada linha de conteúdo deve ser cortada, legendada e ritmada" acao={
        <button onClick={novo} className="flex min-h-[40px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo DNA
        </button>
      } />

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : dnas.length === 0 ? (
        <EmptyState icone={Dna} titulo="Nenhum Editing DNA ainda" descricao="Crie um conjunto de regras, ex: IVEASOR DNA, COVER DNA, GAMING DNA." />
      ) : !selecionado ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dnas.map((d) => (
            <Card key={d.id} className="cursor-pointer p-3 hover:border-neutral-700" onClick={() => setSelecionadoId(d.id)}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-neutral-100">{d.nome}</p>
                {!d.ativo && <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-500">inativo</span>}
              </div>
              <p className="line-clamp-2 text-[11px] text-neutral-500">{d.descricao || "sem descrição"}</p>
            </Card>
          ))}
        </div>
      ) : (
        <DnaDetalhe userId={user!.id} dna={selecionado} onVoltar={() => setSelecionadoId(null)} onSalvar={(patch) => { atualizarDna(selecionado.id, patch); setDnas((prev) => prev.map((d) => (d.id === selecionado.id ? { ...d, ...patch } : d))); }} onExcluir={() => excluir(selecionado.id)} />
      )}
    </div>
  );
}

function DnaDetalhe({ userId, dna, onVoltar, onSalvar, onExcluir }: {
  userId: string; dna: EditingDna; onVoltar: () => void; onSalvar: (patch: Partial<EditingDna>) => void; onExcluir: () => void;
}) {
  const [regras, setRegras] = useState<DnaRegra[]>([]);
  const [referencias, setReferencias] = useState<DnaReferencia[]>([]);
  const [autoEdit, setAutoEdit] = useState<DnaAutoEdit | null>(null);
  const [novaRegra, setNovaRegra] = useState("");
  const [categoriaRegra, setCategoriaRegra] = useState<CategoriaDnaRegra>("ritmo");
  const [buscaRef, setBuscaRef] = useState("");
  const [resultadosAsset, setResultadosAsset] = useState<ItemBiblioteca[]>([]);
  const [criadoresRadar, setCriadoresRadar] = useState<CriadorRadar[]>([]);
  const [mostrarBusca, setMostrarBusca] = useState(false);

  const carregar = useCallback(async () => {
    const [r, ref, ae] = await Promise.all([listarRegras(dna.id), listarReferenciasDna(dna.id), obterAutoEdit(dna.id)]);
    setRegras(r);
    setReferencias(ref);
    setAutoEdit(ae);
  }, [dna.id]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!mostrarBusca) return;
    buscarNaBiblioteca(userId, buscaRef, "asset").then(setResultadosAsset);
    listarCriadoresRadar(userId).then(setCriadoresRadar);
  }, [mostrarBusca, buscaRef, userId]);

  async function addRegra() {
    if (!novaRegra.trim()) return;
    await adicionarRegra(userId, dna.id, categoriaRegra, novaRegra.trim());
    setNovaRegra("");
    carregar();
  }
  async function delRegra(id: string) {
    await excluirRegra(id);
    carregar();
  }
  async function addRefAsset(item: ItemBiblioteca) {
    await adicionarReferenciaAsset(userId, dna.id, item.tabelaOrigem, item.id);
    setMostrarBusca(false);
    carregar();
  }
  async function addRefCriador(c: CriadorRadar) {
    await adicionarReferenciaCriador(userId, dna.id, c.id);
    setMostrarBusca(false);
    carregar();
  }
  async function delRef(id: string) {
    await excluirReferenciaDna(id);
    carregar();
  }

  function campoAutoEdit<K extends keyof DnaAutoEdit>(campo: K, valor: DnaAutoEdit[K]) {
    salvarAutoEdit(userId, dna.id, autoEdit?.id ?? null, { [campo]: valor } as Partial<DnaAutoEdit>).then(carregar);
  }

  const porCategoria = CATEGORIAS.map((c) => ({ categoria: c, itens: regras.filter((r) => r.categoria === c) }));

  return (
    <div>
      <button onClick={onVoltar} className="mb-4 text-xs text-neutral-400 hover:text-neutral-200">← Todos os DNA</button>

      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <EditableField value={dna.nome} onSave={(v) => onSalvar({ nome: v })} displayClassName="text-lg font-semibold text-neutral-100" />
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <input type="checkbox" checked={dna.ativo} onChange={(e) => onSalvar({ ativo: e.target.checked })} /> ativo
            </label>
            <button onClick={onExcluir} className="text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        <EditableField value={dna.descricao ?? ""} onSave={(v) => onSalvar({ descricao: v || null })} as="textarea" placeholder="Descrição do que esse DNA representa" displayClassName="text-xs text-neutral-400" />
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Regras</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <select value={categoriaRegra} onChange={(e) => setCategoriaRegra(e.target.value as CategoriaDnaRegra)} className="min-h-[34px] rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <input value={novaRegra} onChange={(e) => setNovaRegra(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRegra()} placeholder="ex: preservar pequenas pausas naturais" className="min-h-[34px] min-w-[240px] flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
          <button onClick={addRegra} className="rounded-md border border-neutral-800 px-3 text-xs text-teal-300 hover:bg-teal-500/10">Adicionar</button>
        </div>
        {regras.length === 0 ? (
          <p className="py-4 text-center text-xs text-neutral-600">Nenhuma regra ainda.</p>
        ) : (
          <div className="space-y-2">
            {porCategoria.filter((g) => g.itens.length > 0).map((g) => (
              <div key={g.categoria}>
                <p className="mb-1 text-[10px] uppercase text-neutral-600">{g.categoria.replace("_", " ")}</p>
                <div className="space-y-1">
                  {g.itens.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 px-2 py-1.5">
                      <p className="text-xs text-neutral-300">{r.regra}</p>
                      <button onClick={() => delRegra(r.id)} className="shrink-0 text-neutral-600 hover:text-[#F0997B]"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Auto-edit (sugestões, nunca corte irreversível)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CampoNumero rotulo="Remover silêncio acima de (ms)" valor={autoEdit?.remover_silencio_acima_ms ?? null} onSalvar={(v) => campoAutoEdit("remover_silencio_acima_ms", v)} />
          <CampoNumero rotulo="Preservar silêncio abaixo de (ms)" valor={autoEdit?.preservar_silencio_abaixo_ms ?? null} onSalvar={(v) => campoAutoEdit("preservar_silencio_abaixo_ms", v)} />
          <label className="flex items-center gap-1.5 self-end pb-1.5 text-[11px] text-neutral-400">
            <input type="checkbox" checked={autoEdit?.jump_cut ?? false} onChange={(e) => campoAutoEdit("jump_cut", e.target.checked)} /> jump cut habilitado
          </label>
          <CampoNumero rotulo="Zoom intensidade máx" valor={autoEdit?.zoom_intensidade_max ?? null} onSalvar={(v) => campoAutoEdit("zoom_intensidade_max", v)} />
          <CampoNumero rotulo="Zoom intervalo mín (ms)" valor={autoEdit?.zoom_intervalo_min_ms ?? null} onSalvar={(v) => campoAutoEdit("zoom_intervalo_min_ms", v)} />
          <CampoNumero rotulo="Plano duração mín (ms)" valor={autoEdit?.plano_duracao_min_ms ?? null} onSalvar={(v) => campoAutoEdit("plano_duracao_min_ms", v)} />
          <CampoNumero rotulo="Plano duração máx (ms)" valor={autoEdit?.plano_duracao_max_ms ?? null} onSalvar={(v) => campoAutoEdit("plano_duracao_max_ms", v)} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Referências</p>
          <button onClick={() => setMostrarBusca((v) => !v)} className="text-[11px] text-teal-300 hover:underline">{mostrarBusca ? "fechar" : "+ associar"}</button>
        </div>
        {mostrarBusca && (
          <div className="mb-3 rounded-md border border-neutral-800 p-2">
            <input value={buscaRef} onChange={(e) => setBuscaRef(e.target.value)} placeholder="buscar asset ou criador do Radar..." className="mb-2 min-h-[32px] w-full rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {resultadosAsset.map((item) => (
                <button key={`${item.tabelaOrigem}:${item.id}`} onClick={() => addRefAsset(item)} className="block w-full rounded px-2 py-1 text-left text-[11px] text-neutral-300 hover:bg-neutral-900">
                  {item.rotuloTabela}: {item.titulo}
                </button>
              ))}
              {criadoresRadar.filter((c) => !buscaRef.trim() || c.nome.toLowerCase().includes(buscaRef.toLowerCase())).map((c) => (
                <button key={c.id} onClick={() => addRefCriador(c)} className="block w-full rounded px-2 py-1 text-left text-[11px] text-neutral-300 hover:bg-neutral-900">
                  Criador Radar: {c.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        {referencias.length === 0 ? (
          <p className="text-xs text-neutral-600">Nenhuma referência associada, nada é duplicado, só um vínculo.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {referencias.map((r) => (
              <span key={r.id} className="flex items-center gap-1 rounded-full border border-neutral-800 px-2 py-1 text-[11px] text-neutral-300">
                {r.tipo === "asset" ? `${r.tabela_asset}` : "criador Radar"}
                <button onClick={() => delRef(r.id)} className="text-neutral-600 hover:text-[#F0997B]"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CampoNumero({ rotulo, valor, onSalvar }: { rotulo: string; valor: number | null; onSalvar: (v: number | null) => void }) {
  return (
    <div>
      <p className="mb-1 text-[10px] text-neutral-600">{rotulo}</p>
      <input type="number" defaultValue={valor ?? ""} onBlur={(e) => onSalvar(e.target.value === "" ? null : Number(e.target.value))} className="min-h-[32px] w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
    </div>
  );
}
