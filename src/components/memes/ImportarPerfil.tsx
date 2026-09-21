"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ImportarPerfil() {
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function importarPerfil() {
    const supabase = supabaseBrowser();
    const link = url.trim();

    if (!link) {
      setMensagem("Cole o link de um perfil.");
      return;
    }

    if (!link.includes("tiktok.com/@")) {
      setMensagem(
        "Use um link de perfil do TikTok, como https://www.tiktok.com/@perfil"
      );
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Você precisa estar logada no ECHO.");
      }

      const { error } = await supabase
        .from("meme_import_queue")
        .insert({
          user_id: user.id,
          source_url: link,
          source_type: "profile",
          categoria,
          status: "pending",
        });

      if (error) {
        throw error;
      }

      setUrl("");
      setMensagem("Perfil adicionado. Aguardando importação.");
    } catch (erro) {
      console.error(erro);

      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Não foi possível adicionar o perfil."
      );
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

      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="min-h-[38px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-300 outline-none focus:border-teal-500/40"
      >
        <option value="geral">Geral</option>
        <option value="iveasor">IveAsor</option>
        <option value="asor">ASOR</option>
        <option value="aivil">AIVIL</option>
      </select>

      <button
        type="button"
        onClick={importarPerfil}
        disabled={carregando}
        className="flex min-h-[38px] w-full items-center justify-center rounded-md bg-teal-500 px-4 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
      >
        {carregando ? "Adicionando..." : "Importar"}
      </button>

      {mensagem && <p className="text-[11px] text-neutral-500">{mensagem}</p>}
    </div>
  );
}
