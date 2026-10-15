"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { colunaFaltando } from "@/lib/lixeiraConfig";
import { lerFiltroMarca, passaNaMarca, type FiltroMarca, type MarcaSlug } from "@/lib/marca";

interface ContextoMarca {
  marca: FiltroMarca;
  setMarca: (m: FiltroMarca) => void;
  // false ate a migration 0032 rodar: nada grava marca_slug (gravaria erro) e o filtro so usa as etiquetas antigas.
  disponivel: boolean;
  passa: (marcaItem: MarcaSlug | null) => boolean;
  // Marca do item novo: a selecionada (ou nenhuma em "Todas"), so quando a coluna existe.
  campoNovo: () => { marca_slug?: MarcaSlug };
}

const Contexto = createContext<ContextoMarca | null>(null);
const CHAVE = "echo-assets:marca";

export default function MarcaProvider({ children }: { children: ReactNode }) {
  const [marca, setMarcaInterna] = useState<FiltroMarca>("todas");
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    try { setMarcaInterna(lerFiltroMarca(window.localStorage.getItem(CHAVE))); } catch { /* ignora */ }
    supabaseBrowser().from("memes").select("marca_slug").limit(1).then(({ error }) => {
      setDisponivel(!error || !colunaFaltando(error.message));
    });
  }, []);

  const setMarca = useCallback((m: FiltroMarca) => {
    setMarcaInterna(m);
    try { window.localStorage.setItem(CHAVE, m); } catch { /* ignora */ }
  }, []);

  const valor = useMemo<ContextoMarca>(() => ({
    marca, setMarca, disponivel,
    passa: (marcaItem) => passaNaMarca(marcaItem, marca),
    campoNovo: () => (disponivel && marca !== "todas" ? { marca_slug: marca } : {}),
  }), [marca, setMarca, disponivel]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMarca(): ContextoMarca {
  const c = useContext(Contexto);
  if (!c) throw new Error("useMarca fora do MarcaProvider");
  return c;
}
