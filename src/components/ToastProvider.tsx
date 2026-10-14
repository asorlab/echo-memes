"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { EVENTO_ERRO_BANCO } from "@/lib/supabase/client";

const ToastContext = createContext<(mensagem: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// Mensagem de falha fica vermelha e mais tempo na tela; o resto continua como confirmação.
const ehFalha = (m: string) => /^(Não salvou|Não |Erro|Falta|Automações paradas)/i.test(m);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mensagem, setMensagem] = useState("");

  const mostrar = useCallback((msg: string) => setMensagem(msg), []);

  // Gravação recusada pelo banco em qualquer tela (ver supabase/client.ts).
  useEffect(() => {
    const ouvir = (e: Event) => setMensagem(String((e as CustomEvent).detail ?? "Não salvou"));
    window.addEventListener(EVENTO_ERRO_BANCO, ouvir);
    return () => window.removeEventListener(EVENTO_ERRO_BANCO, ouvir);
  }, []);

  useEffect(() => {
    if (!mensagem) return;
    const t = setTimeout(() => setMensagem(""), ehFalha(mensagem) ? 6000 : 2600);
    return () => clearTimeout(t);
  }, [mensagem]);

  const falha = ehFalha(mensagem);
  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      {mensagem && (
        <div role={falha ? "alert" : "status"} className={`fixed bottom-5 left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border px-4 py-2.5 text-xs shadow-2xl ${falha ? "border-[#F0997B]/50 bg-neutral-950 text-[#F0997B]" : "border-neutral-800 bg-neutral-900 text-neutral-200"}`}>
          <div className="flex items-center gap-2">
            {falha ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#1D9E75" }} />}
            {mensagem}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
