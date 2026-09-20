"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser, supabaseConfigurado } from "./supabase/client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoConfigurado, setNaoConfigurado] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado()) {
      setNaoConfigurado(true);
      setCarregando(false);
      return;
    }
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setCarregando(false);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUser(sessao?.user ?? null);
    });

    // Se a aba fica em segundo plano por um tempo, o token de sessao expira e a proxima
    // requisicao (ex: salvar algo) falha com 401 antes do refresh automatico acontecer.
    // Forca uma renovacao assim que a aba volta a ficar visivel, antes do usuario clicar em algo.
    function aoFicarVisivel() {
      if (document.visibilityState === "visible") supabase.auth.refreshSession();
    }
    document.addEventListener("visibilitychange", aoFicarVisivel);

    return () => {
      assinatura.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", aoFicarVisivel);
    };
  }, []);

  return { user, carregando, naoConfigurado };
}
