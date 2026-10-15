"use client";

import { Search, X } from "lucide-react";

export interface OpcaoFiltro { id: string; rotulo: string; contagem?: number }

interface FilterBarProps {
  opcoes: OpcaoFiltro[];
  ativo: string | null;
  onMudar: (id: string | null) => void;
  rotuloTodos?: string;
  busca?: string;
  onBusca?: (texto: string) => void;
  placeholderBusca?: string;
}

// Chips de filtro (um ativo por vez) + busca opcional + limpar.
export default function FilterBar({ opcoes, ativo, onMudar, rotuloTodos = "Todos", busca, onBusca, placeholderBusca = "Buscar" }: FilterBarProps) {
  const temFiltro = ativo !== null || (busca ?? "").trim() !== "";
  const chip = (selecionado: boolean) =>
    `flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50 ${
      selecionado ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"
    }`;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filtros">
      {onBusca && (
        <label className="flex min-h-[32px] items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-2 focus-within:border-teal-500/40">
          <Search className="h-3.5 w-3.5 text-neutral-500" />
          <input value={busca ?? ""} onChange={(e) => onBusca(e.target.value)} placeholder={placeholderBusca} aria-label={placeholderBusca} className="w-36 bg-transparent text-xs text-neutral-200 outline-none" />
        </label>
      )}
      <button type="button" onClick={() => onMudar(null)} aria-pressed={ativo === null} className={chip(ativo === null)}>{rotuloTodos}</button>
      {opcoes.map((o) => (
        <button key={o.id} type="button" onClick={() => onMudar(ativo === o.id ? null : o.id)} aria-pressed={ativo === o.id} className={chip(ativo === o.id)}>
          {o.rotulo}{o.contagem != null && <span className="text-neutral-500">{o.contagem}</span>}
        </button>
      ))}
      {temFiltro && (
        <button type="button" onClick={() => { onMudar(null); onBusca?.(""); }} className="flex min-h-[32px] items-center gap-1 px-1.5 text-[11px] text-neutral-500 hover:text-neutral-300">
          <X className="h-3 w-3" /> Limpar
        </button>
      )}
    </div>
  );
}
