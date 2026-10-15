"use client";

import { MARCAS, nomeMarca, type FiltroMarca, type MarcaSlug } from "@/lib/marca";
import { useMarca } from "./MarcaProvider";

const OPCOES: { id: FiltroMarca; rotulo: string }[] = [...MARCAS.map((m) => ({ id: m.slug, rotulo: m.nome })), { id: "todas", rotulo: "Todas" }];

// Seletor global (sidebar): o que aparece em todas as telas.
export function SeletorMarca() {
  const { marca, setMarca } = useMarca();
  return (
    <div role="radiogroup" aria-label="Marca" className="grid grid-cols-3 gap-0.5 rounded-md border border-neutral-800 p-0.5">
      {OPCOES.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={marca === o.id} onClick={() => setMarca(o.id)}
          className={`min-h-[30px] rounded px-1 font-mono text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50 ${marca === o.id ? "bg-teal-500/10 text-teal-300" : "text-neutral-500 hover:text-neutral-200"}`}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

// Campo da gaveta: de qual marca e o item (ou compartilhado entre as duas).
export function CampoMarca({ valor, onMudar }: { valor: MarcaSlug | null; onMudar: (m: MarcaSlug | null) => void }) {
  const { disponivel } = useMarca();
  const chip = (ativo: boolean) => `rounded-full border px-2.5 py-1 text-[11px] disabled:opacity-40 ${ativo ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Marca</p>
      <div className="flex flex-wrap gap-1.5">
        {MARCAS.map((m) => (
          <button key={m.slug} type="button" disabled={!disponivel} aria-pressed={valor === m.slug} onClick={() => onMudar(m.slug)} className={chip(valor === m.slug)}>{m.nome}</button>
        ))}
        <button type="button" disabled={!disponivel} aria-pressed={valor === null} onClick={() => onMudar(null)} className={chip(valor === null)}>Compartilhado</button>
      </div>
      {!disponivel && <p className="mt-1 text-[10px] text-amber-400/80">Para marcar, falta rodar a migration 0032 no Supabase.</p>}
    </div>
  );
}

// Selo no card, so quando a tela mostra as duas marcas juntas.
export function SeloMarca({ valor }: { valor: MarcaSlug | null }) {
  const { marca } = useMarca();
  if (marca !== "todas" || valor === null) return null;
  return <span className="shrink-0 rounded-full border border-neutral-700 px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">{nomeMarca(valor)}</span>;
}
