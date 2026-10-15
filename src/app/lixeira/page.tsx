"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { listarLixeira, restaurarItem, excluirDefinitivamente, type ItemLixeira } from "@/lib/lixeira";
import FilterBar from "@/components/ui/FilterBar";
import BulkBar from "@/components/ui/BulkBar";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const chaveDe = (item: ItemLixeira) => `${item.tabela}:${item.id}`;

// Texto do confirm: o que some, inclusive o que vai junto pelo cascade.
function textoConfirmacao(itens: ItemLixeira[]): string {
  const avisos = Array.from(new Set(itens.map((i) => i.aviso).filter((a): a is string => !!a)));
  const cabeca = itens.length === 1 ? `Excluir definitivamente "${itens[0].titulo}"?` : `Excluir definitivamente ${itens.length} itens?`;
  return [cabeca, ...avisos, "Essa ação não pode ser desfeita."].join("\n\n");
}

export default function LixeiraPage() {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const lista = await listarLixeira(user.id);
    setItens(lista);
    setSelecionados((atual) => new Set(Array.from(atual).filter((k) => lista.some((i) => chaveDe(i) === k))));
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const opcoesTipo = useMemo(() => {
    const contagem = new Map<string, { rotulo: string; n: number }>();
    for (const i of itens) {
      const atual = contagem.get(i.tabela) ?? { rotulo: i.rotulo, n: 0 };
      contagem.set(i.tabela, { ...atual, n: atual.n + 1 });
    }
    return Array.from(contagem.entries()).map(([id, v]) => ({ id, rotulo: v.rotulo, contagem: v.n }));
  }, [itens]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => (!tipo || i.tabela === tipo) && (!termo || i.titulo.toLowerCase().includes(termo)));
  }, [itens, tipo, busca]);

  const escolhidos = visiveis.filter((i) => selecionados.has(chaveDe(i)));

  function alternar(item: ItemLixeira) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      const k = chaveDe(item);
      if (novo.has(k)) novo.delete(k); else novo.add(k);
      return novo;
    });
  }

  async function restaurar(lista: ItemLixeira[]) {
    setProcessando(true);
    let falha = 0;
    for (const item of lista) {
      try { await restaurarItem(item); } catch { falha++; }
    }
    setProcessando(false);
    const ok = lista.length - falha;
    toast(falha === 0 ? (ok === 1 ? `"${lista[0].titulo}" restaurado` : `${ok} itens restaurados`) : `${ok} restaurado(s), ${falha} com erro`);
    await carregar();
  }

  async function excluir(lista: ItemLixeira[]) {
    if (lista.length === 0 || !window.confirm(textoConfirmacao(lista))) return;
    setProcessando(true);
    let falha = 0;
    for (const item of lista) {
      try { await excluirDefinitivamente(item); } catch { falha++; }
    }
    setProcessando(false);
    const ok = lista.length - falha;
    toast(falha === 0 ? `${ok} item(ns) excluído(s) definitivamente` : `${ok} excluído(s), ${falha} falharam e continuam na lixeira`);
    await carregar();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Lixeira</h1>
          <p className="text-xs text-neutral-500">Itens excluídos das bibliotecas, projetos e Production. Restaure ou remova de vez.</p>
        </div>
        <button
          onClick={() => excluir(visiveis)}
          disabled={visiveis.length === 0 || processando}
          className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-[#F0997B]/40 px-3 text-xs text-[#F0997B] hover:bg-[#F0997B]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {tipo || busca ? "Esvaziar os filtrados" : "Esvaziar lixeira"}
        </button>
      </div>

      {itens.length > 0 && (
        <FilterBar opcoes={opcoesTipo} ativo={tipo} onMudar={setTipo} busca={busca} onBusca={setBusca} placeholderBusca="Buscar na lixeira" />
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-500">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-neutral-500">
          <Trash2 className="h-6 w-6" />
          <span className="text-sm">Lixeira vazia</span>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">Nada com esse filtro.</p>
      ) : (
        <div className="space-y-1.5">
          {visiveis.map((item) => {
            const marcado = selecionados.has(chaveDe(item));
            return (
              <div key={chaveDe(item)} className={`flex items-center gap-3 rounded-md border bg-neutral-900/60 p-3 ${marcado ? "border-teal-500/40" : "border-neutral-800"}`}>
                <input type="checkbox" checked={marcado} onChange={() => alternar(item)} aria-label={`Selecionar ${item.titulo}`} className="h-4 w-4 shrink-0 accent-teal-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{item.rotulo}</span>
                    <p className="truncate text-sm text-neutral-200">{item.titulo}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-neutral-500">Excluído em {formatarData(item.excluidoEm)}</p>
                </div>
                <button onClick={() => restaurar([item])} disabled={processando} title="Restaurar" aria-label={`Restaurar ${item.titulo}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-teal-500/10 hover:text-teal-400 disabled:opacity-40">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => excluir([item])} disabled={processando} title="Excluir definitivamente" aria-label={`Excluir definitivamente ${item.titulo}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-[#F0997B1A] hover:text-[#F0997B] disabled:opacity-40">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <BulkBar
        quantidade={escolhidos.length}
        total={visiveis.length}
        onSelecionarTodos={() => setSelecionados(new Set(visiveis.map(chaveDe)))}
        onLimpar={() => setSelecionados(new Set())}
      >
        <button onClick={() => restaurar(escolhidos)} disabled={processando} className="flex min-h-[32px] items-center gap-1.5 rounded-md border border-teal-500/30 px-2.5 text-xs text-teal-300 hover:bg-teal-500/10 disabled:opacity-40">
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
        </button>
        <button onClick={() => excluir(escolhidos)} disabled={processando} className="flex min-h-[32px] items-center gap-1.5 rounded-md border border-[#F0997B]/40 px-2.5 text-xs text-[#F0997B] hover:bg-[#F0997B]/10 disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5" /> Excluir de vez
        </button>
      </BulkBar>
    </div>
  );
}
