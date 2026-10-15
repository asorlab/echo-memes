"use client";

import { useEffect, useState } from "react";
import { formatarTimecode, lerTimecode } from "@/lib/timecode";

interface TimecodeProps {
  valorMs: number;
  onSalvar: (ms: number) => void;
  rotulo: string;
  className?: string;
}

// Campo de tempo em mm:ss (ou h:mm:ss). So grava ao sair do campo ou no Enter,
// e so se o valor mudou; texto invalido volta para o valor anterior.
export default function Timecode({ valorMs, onSalvar, rotulo, className = "" }: TimecodeProps) {
  const [texto, setTexto] = useState(formatarTimecode(valorMs));
  const [invalido, setInvalido] = useState(false);

  useEffect(() => { setTexto(formatarTimecode(valorMs)); setInvalido(false); }, [valorMs]);

  function confirmar() {
    const ms = lerTimecode(texto);
    if (ms === null) { setInvalido(true); setTexto(formatarTimecode(valorMs)); return; }
    setInvalido(false);
    setTexto(formatarTimecode(ms));
    if (ms !== valorMs) onSalvar(ms);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={rotulo}
      title={invalido ? "Use minutos:segundos, por exemplo 12:41" : rotulo}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } if (e.key === "Escape") setTexto(formatarTimecode(valorMs)); }}
      placeholder="0:00"
      className={`min-h-[32px] rounded border bg-neutral-950 px-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-teal-500/40 ${invalido ? "border-[#F0997B]/60" : "border-neutral-800"} ${className}`}
    />
  );
}
