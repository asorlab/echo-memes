"use client";

import { useEffect } from "react";

// ?abrir=<id> abre a gaveta do item. Vale na chegada (link da busca, link vindo do
// ECHO OS) e tambem quando a busca aponta para a tela em que a pessoa ja esta.
export const EVENTO_ABRIR_ITEM = "echo:abrir-item";

export function useAbrirDaUrl(abrir: (id: string) => void) {
  useEffect(() => {
    const ler = () => {
      try {
        const id = new URLSearchParams(window.location.search).get("abrir");
        if (id) abrir(id);
      } catch { /* ignora */ }
    };
    ler();
    window.addEventListener(EVENTO_ABRIR_ITEM, ler);
    window.addEventListener("popstate", ler);
    return () => { window.removeEventListener(EVENTO_ABRIR_ITEM, ler); window.removeEventListener("popstate", ler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
