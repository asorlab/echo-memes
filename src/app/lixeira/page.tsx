"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { listarLixeira, restaurarItem, excluirDefinitivamente, type ItemLixeira } from "@/lib/lixeira";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function LixeiraPage() {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [esvaziando, setEsvaziando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const lista = await listarLixeira(user.id);
    setItens(lista);
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function restaurar(item: ItemLixeira) {
    setProcessandoId(item.id);
    try {
      await restaurarItem(item);
      toast(`"${item.titulo}" restaurado`);
      await carregar();
    } catch {
      toast("Erro ao restaurar");
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluirItem(item: ItemLixeira) {
    if (!window.confirm(`Excluir definitivamente "${item.titulo}"? Essa ação não pode ser desfeita.`)) return;
    setProcessandoId(item.id);
    try {
      await excluirDefinitivamente(item);
      toast("Excluído definitivamente");
      await carregar();
    } catch {
      toast("Erro ao remover o arquivo, o item continua na lixeira");
    } finally {
      setProcessandoId(null);
    }
  }

  async function esvaziarLixeira() {
    if (itens.length === 0) return;
    if (!window.confirm(`Excluir definitivamente ${itens.length} item(ns) da lixeira? Essa ação não pode ser desfeita.`)) return;
    setEsvaziando(true);
    let sucesso = 0;
    let falha = 0;
    for (const item of itens) {
      try {
        await excluirDefinitivamente(item);
        sucesso++;
      } catch {
        falha++;
      }
    }
    setEsvaziando(false);
    toast(falha === 0 ? `${sucesso} item(ns) excluído(s) definitivamente` : `${sucesso} excluído(s), ${falha} falharam e continuam na lixeira`);
    await carregar();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Lixeira</h1>
          <p className="text-xs text-neutral-600">Itens excluídos das bibliotecas, restaura ou remove de vez.</p>
        </div>
        <button
          onClick={esvaziarLixeira}
          disabled={itens.length === 0 || esvaziando}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-[#F0997B]/40 px-3 text-xs text-[#F0997B] hover:bg-[#F0997B]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {esvaziando ? "Esvaziando..." : "Esvaziar lixeira"}
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-neutral-600">
          <Trash2 className="h-6 w-6" />
          <span className="text-sm">Lixeira vazia</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {itens.map((item) => (
            <div key={`${item.tabela}-${item.id}`} className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{item.rotulo}</span>
                  <p className="truncate text-sm text-neutral-200">{item.titulo}</p>
                </div>
                <p className="mt-0.5 text-[10px] text-neutral-600">Excluído em {formatarData(item.excluidoEm)}</p>
              </div>
              <button
                onClick={() => restaurar(item)}
                disabled={processandoId === item.id}
                title="Restaurar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-teal-500/10 hover:text-teal-400 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => excluirItem(item)}
                disabled={processandoId === item.id}
                title="Excluir definitivamente"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-[#F0997B1A] hover:text-[#F0997B] disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
