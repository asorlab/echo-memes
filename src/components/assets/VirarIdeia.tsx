"use client";

import { useState } from "react";
import { Lightbulb, ArrowUpRight, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import type { Registro } from "@/components/assets/AssetLibrary";
import { ECHO_OS_URL } from "@/lib/sistemas";

// Ponte Assets -> ECHO OS: a inspiracao guardada aqui vira ideia no Banco de
// ideias do ECHO OS (tabela os_ideias, mesmo Supabase). Assets guarda o
// material; o ECHO OS decide e agenda. A ideia leva o link de volta
// (?abrir=<id>) e a inspiracao guarda o ideia_id pra nao duplicar.

const UNIVERSO_POR_MARCA: Record<string, string> = { iveasor: "IveAsor", asor: "ASOR.lab", aivil: "AIVIL" };

export default function VirarIdeia({ item, recarregar }: { item: Registro; recarregar: () => void }) {
  const { user } = useUser();
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const marca = typeof item.marca === "string" ? item.marca : null;
  const universo = marca ? UNIVERSO_POR_MARCA[marca] : undefined;
  const linkEchoOs = `${ECHO_OS_URL}/?espaco=${marca ?? ""}&section=producao`;

  async function virarIdeia() {
    if (!user || !marca || !universo || enviando) return;
    setEnviando(true);
    const supabase = supabaseBrowser();
    const nota = [
      typeof item.nota === "string" ? item.nota.trim() : "",
      item.link_origem ? `Referência: ${item.link_origem}` : "",
      `Origem: Assets, Inspirações ${window.location.origin}/inspiracoes?abrir=${item.id}`,
    ].filter(Boolean).join("\n");
    const { data, error } = await supabase
      .from("os_ideias")
      .insert({ user_id: user.id, espaco: marca, titulo: item.titulo || "Ideia do Assets", nota, tags: item.tags ?? [], universo })
      .select("id")
      .single();
    if (error || !data) { setEnviando(false); toast("Não foi possível criar a ideia"); return; }
    const { error: erroVinculo } = await supabase.from("inspiracoes").update({ ideia_id: data.id }).eq("id", item.id);
    setEnviando(false);
    toast(erroVinculo ? "Ideia criada no ECHO OS (o vínculo ainda não foi salvo aqui)" : "Ideia criada no Banco de ideias do ECHO OS");
    recarregar();
  }

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-600">
        <Lightbulb className="h-3 w-3" /> ECHO OS
      </p>
      {item.ideia_id ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-teal-300"><Check className="h-3.5 w-3.5" /> Já está no Banco de ideias</span>
          <a href={linkEchoOs} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200">
            Abrir no ECHO OS <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      ) : universo ? (
        <button
          onClick={virarIdeia}
          disabled={enviando}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-teal-500/40 px-3 text-xs text-teal-300 hover:bg-teal-500/10 disabled:opacity-50"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> {enviando ? "Enviando..." : `Virar ideia em ${universo}`}
        </button>
      ) : (
        <p className="text-[11px] text-neutral-500">Escolha a marca (IveAsor, ASOR.lab ou AIVIL) para mandar esta inspiração pro Banco de ideias.</p>
      )}
    </div>
  );
}
