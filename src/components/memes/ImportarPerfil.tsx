"use client";

import { useState } from "react";
import { useUser } from "@/lib/useUser";
import { adicionarFonteEExecutar } from "@/lib/contas";

function extrairUsername(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/^\/@([^/]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export default function ImportarPerfil({ urlInicial = "" }: { urlInicial?: string }) {
  const { user } = useUser();
  const [url, setUrl] = useState(urlInicial);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function importarPerfil() {
    const link = url.trim();

    if (!link) {
      setMensagem("Cole o link de um perfil.");
      return;
    }
    if (!link.includes("tiktok.com/@")) {
      setMensagem("Use um link de perfil do TikTok, como https://www.tiktok.com/@perfil");
      return;
    }
    const username = extrairUsername(link);
    if (!username) {
      setMensagem("Não consegui identificar o @usuário nesse link.");
      return;
    }
    if (!user) {
      setMensagem("Você precisa estar logada no ECHO.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    try {
      await adicionarFonteEExecutar(user.id, "tiktok", username, link);
      setUrl("");
      setMensagem("Perfil adicionado como Conta. Acompanhe em Contas → @" + username + ".");
    } catch (erro) {
      console.error(erro);
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível adicionar o perfil.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-600">Perfil do TikTok</p>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.tiktok.com/@perfil"
        className="min-h-[38px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none placeholder-neutral-600 focus:border-teal-500/40"
      />

      <button
        type="button"
        onClick={importarPerfil}
        disabled={carregando}
        className="flex min-h-[38px] w-full items-center justify-center rounded-md bg-teal-500 px-4 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
      >
        {carregando ? "Adicionando..." : "Importar"}
      </button>

      {mensagem && <p className="text-[11px] text-neutral-500">{mensagem}</p>}
      <p className="text-[10px] text-neutral-600">Isso vira uma Conta acompanhada, dá pra sincronizar de novo depois, só trazendo conteúdo novo.</p>
    </div>
  );
}
