"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

interface BulkBarProps {
  quantidade: number;
  onLimpar: () => void;
  onSelecionarTodos?: () => void;
  total?: number;
  children: ReactNode; // botoes das acoes em lote
}

// Barra que aparece quando ha itens selecionados. Fica presa embaixo da tela
// (no celular cabe o polegar) e nao cobre o conteudo quando nao ha selecao.
export default function BulkBar({ quantidade, onLimpar, onSelecionarTodos, total, children }: BulkBarProps) {
  if (quantidade === 0) return null;
  return (
    <div role="region" aria-label="Ações em lote" className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-teal-500/30 bg-neutral-950/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="font-mono text-xs text-teal-300">{quantidade} selecionado{quantidade > 1 ? "s" : ""}</span>
      {onSelecionarTodos && total != null && quantidade < total && (
        <button type="button" onClick={onSelecionarTodos} className="text-[11px] text-neutral-400 hover:text-neutral-200">Selecionar os {total}</button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>
      <button type="button" onClick={onLimpar} title="Limpar seleção" aria-label="Limpar seleção" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
