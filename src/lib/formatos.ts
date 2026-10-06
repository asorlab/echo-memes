import type { Formato } from "@/lib/types";

// Lista UNICA de formatos de conteudo ("Onde usar") para Memes, Edits e
// Inspiracoes. Segue o universo do hub IVEASOR (Lifestyle, Fashion, Vlog,
// Gaming, Covers, ASMR, Bastidores, Cultura de internet) + GRWM e Short-form.
// Os ids antigos foram mantidos, entao nada salvo antes se perde.
export const FORMATOS_CONTEUDO: { id: Formato; rotulo: string }[] = [
  { id: "lifestyle", rotulo: "Lifestyle" }, { id: "fashion", rotulo: "Fashion" }, { id: "vlog", rotulo: "Vlog" },
  { id: "grwm", rotulo: "GRWM" }, { id: "gaming", rotulo: "Gaming" }, { id: "cover", rotulo: "Cover" },
  { id: "asmr", rotulo: "ASMR" }, { id: "bastidores", rotulo: "Bastidores" }, { id: "cultura_internet", rotulo: "Cultura de internet" },
  { id: "short_form", rotulo: "Short-form" },
];
