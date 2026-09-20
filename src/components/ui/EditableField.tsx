"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { parseValorMoeda, paraEdicaoMoeda } from "@/lib/format";

interface EditableFieldProps {
  value: string;
  onSave: (valor: string) => void;
  placeholder?: string;
  as?: "text" | "textarea" | "number" | "date" | "moeda";
  className?: string;
  displayClassName?: string;
  formatDisplay?: (valor: string) => string;
  listaSugestoes?: string[];
}

function paraRascunho(value: string, as: string) {
  if (as !== "moeda") return value;
  return value === "" ? "" : paraEdicaoMoeda(Number(value) || 0);
}

export default function EditableField({
  value,
  onSave,
  placeholder = "Clique para preencher",
  as = "text",
  className = "",
  displayClassName = "",
  formatDisplay,
  listaSugestoes,
}: EditableFieldProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(paraRascunho(value, as));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const datalistId = useId();

  useEffect(() => {
    if (!editando) setRascunho(paraRascunho(value, as));
  }, [value, editando, as]);

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  function salvar() {
    setEditando(false);
    if (as === "moeda") {
      const numero = parseValorMoeda(rascunho);
      if (numero !== Number(value)) onSave(String(numero));
      return;
    }
    if (rascunho !== value) onSave(rascunho);
  }

  function cancelar() {
    setRascunho(as === "moeda" ? paraEdicaoMoeda(Number(value) || 0) : value);
    setEditando(false);
  }

  if (editando) {
    if (as === "textarea") {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelar();
          }}
          rows={4}
          className={`w-full min-h-[44px] rounded-md border border-teal-500/40 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ${className}`}
        />
      );
    }
    return (
      <>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={as === "number" ? "number" : as === "date" ? "date" : "text"}
          inputMode={as === "moeda" ? "decimal" : undefined}
          list={listaSugestoes?.length ? datalistId : undefined}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") cancelar();
          }}
          className={`min-h-[44px] w-full rounded-md border border-teal-500/40 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ${className}`}
        />
        {listaSugestoes?.length ? (
          <datalist id={datalistId}>
            {listaSugestoes.map((s) => <option key={s} value={s} />)}
          </datalist>
        ) : null}
      </>
    );
  }

  const vazio = !value;

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className={`group flex min-h-[44px] w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left hover:border-neutral-800 hover:bg-neutral-900/60 focus:border-teal-500/40 ${displayClassName}`}
    >
      <span className={`flex-1 truncate ${vazio ? "text-neutral-600 italic" : ""}`}>
        {vazio ? placeholder : formatDisplay ? formatDisplay(value) : value}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-neutral-600 opacity-0 group-hover:opacity-100 group-focus:opacity-100" />
    </button>
  );
}
