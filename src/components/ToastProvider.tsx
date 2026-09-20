"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const ToastContext = createContext<(mensagem: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mensagem, setMensagem] = useState("");

  const mostrar = useCallback((msg: string) => setMensagem(msg), []);

  useEffect(() => {
    if (!mensagem) return;
    const t = setTimeout(() => setMensagem(""), 2600);
    return () => clearTimeout(t);
  }, [mensagem]);

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      {mensagem && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-xs text-neutral-200 shadow-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#1D9E75" }} />
            {mensagem}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
