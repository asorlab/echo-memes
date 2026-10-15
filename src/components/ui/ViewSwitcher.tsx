"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List, Table2, type LucideIcon } from "lucide-react";

export type Visualizacao = "grade" | "lista" | "tabela";

const ICONE: Record<Visualizacao, LucideIcon> = { grade: LayoutGrid, lista: List, tabela: Table2 };
const ROTULO: Record<Visualizacao, string> = { grade: "Grade", lista: "Lista", tabela: "Tabela" };

// Guarda a visualizacao escolhida por tela (localStorage), com padrao quando nao ha nada salvo.
export function useVisualizacao(chave: string, padrao: Visualizacao): [Visualizacao, (v: Visualizacao) => void] {
  const [valor, setValor] = useState<Visualizacao>(padrao);
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(`echo-assets:vis:${chave}`);
      if (salvo === "grade" || salvo === "lista" || salvo === "tabela") setValor(salvo);
    } catch { /* ignora */ }
  }, [chave]);
  const mudar = useCallback((v: Visualizacao) => {
    setValor(v);
    try { window.localStorage.setItem(`echo-assets:vis:${chave}`, v); } catch { /* ignora */ }
  }, [chave]);
  return [valor, mudar];
}

interface ViewSwitcherProps {
  valor: Visualizacao;
  onMudar: (v: Visualizacao) => void;
  opcoes?: Visualizacao[];
}

export default function ViewSwitcher({ valor, onMudar, opcoes = ["grade", "lista"] }: ViewSwitcherProps) {
  return (
    <div role="group" aria-label="Visualização" className="flex rounded-md border border-neutral-800 p-0.5">
      {opcoes.map((v) => {
        const Icone = ICONE[v];
        return (
          <button key={v} type="button" onClick={() => onMudar(v)} aria-pressed={valor === v} title={ROTULO[v]} aria-label={ROTULO[v]}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50 ${valor === v ? "bg-teal-500/10 text-teal-300" : "text-neutral-500 hover:text-neutral-200"}`}>
            <Icone className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
