"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, CornerDownLeft } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { FONTES_BUSCA, filtroDaBusca, type FonteBusca } from "@/lib/busca";
import { marcaDoRegistro, nomeMarca, type MarcaSlug } from "@/lib/marca";
import { EVENTO_ABRIR_ITEM } from "@/lib/abrirDaUrl";
import { useMarca } from "@/components/marca/MarcaProvider";

export const EVENTO_ABRIR_BUSCA = "echo:abrir-busca";

interface Resultado { chave: string; titulo: string; rotulo: string; url: string; marca: MarcaSlug | null }

async function buscarEm(fonte: FonteBusca, userId: string, termo: string): Promise<Resultado[]> {
  const filtro = filtroDaBusca(termo, fonte);
  if (!filtro) return [];
  // select("*") de proposito: funciona antes e depois da migration 0032 (marca_slug).
  const { data, error } = await supabaseBrowser().from(fonte.tabela).select("*")
    .eq("user_id", userId).is("excluido_em", null).or(filtro).order("created_at", { ascending: false }).limit(6);
  if (error) { console.error(`busca: ${fonte.tabela}`, error.message); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    chave: `${fonte.tabela}:${r.id}`,
    titulo: (r[fonte.campoTitulo] as string) || "(sem título)",
    rotulo: fonte.rotulo,
    url: fonte.url(String(r.id)),
    marca: marcaDoRegistro(r.marca_slug, fonte.etiquetaMarca ? r[fonte.etiquetaMarca] : undefined),
  }));
}

export default function BuscaGlobal() {
  const { user } = useUser();
  const { marca, passa } = useMarca();
  const router = useRouter();
  const pathname = usePathname();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [foco, setFoco] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  useEffect(() => {
    const abrir = () => setAberta(true);
    const teclado = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta((v) => !v); }
    };
    window.addEventListener(EVENTO_ABRIR_BUSCA, abrir);
    window.addEventListener("keydown", teclado);
    return () => { window.removeEventListener(EVENTO_ABRIR_BUSCA, abrir); window.removeEventListener("keydown", teclado); };
  }, []);

  useEffect(() => { if (aberta) setTimeout(() => inputRef.current?.focus(), 0); else { setTermo(""); setResultados([]); } }, [aberta]);

  useEffect(() => {
    if (!aberta || !user) return;
    const n = ++pedido.current;
    if (termo.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const listas = await Promise.all(FONTES_BUSCA.map((f) => buscarEm(f, user.id, termo)));
      if (n !== pedido.current) return; // resposta de uma digitacao antiga
      setResultados(listas.flat());
      setFoco(0);
      setBuscando(false);
    }, 200);
    return () => clearTimeout(t);
  }, [termo, aberta, user]);

  const visiveis = useMemo(() => resultados.filter((r) => passa(r.marca)), [resultados, passa]);

  const ir = useCallback((r: Resultado) => {
    setAberta(false);
    const destino = new URL(r.url, window.location.origin);
    if (destino.pathname === pathname) {
      window.history.pushState(null, "", r.url);
      window.dispatchEvent(new Event(EVENTO_ABRIR_ITEM));
    } else {
      router.push(r.url);
    }
  }, [pathname, router]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-3 pt-[10vh]" onClick={() => setAberta(false)}>
      <div role="dialog" aria-modal="true" aria-label="Buscar em tudo" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAberta(false);
              if (e.key === "ArrowDown") { e.preventDefault(); setFoco((f) => Math.min(f + 1, visiveis.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)); }
              if (e.key === "Enter" && visiveis[foco]) ir(visiveis[foco]);
            }}
            placeholder="Memes, áudios, fontes, projetos, produções..."
            aria-label="Termo da busca"
            className="min-h-[48px] w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-600 outline-none"
          />
          <button onClick={() => setAberta(false)} aria-label="Fechar busca" className="text-neutral-500 hover:text-neutral-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {termo.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500">Digite pelo menos 2 letras. Busca pelo título e pela tag exata{marca !== "todas" ? `, só em ${nomeMarca(marca)} e compartilhados` : ""}.</p>
          ) : buscando && visiveis.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500">Buscando...</p>
          ) : visiveis.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500">Nada encontrado.</p>
          ) : (
            <ul role="listbox" aria-label="Resultados">
              {visiveis.map((r, i) => (
                <li key={r.chave} role="option" aria-selected={i === foco}>
                  <button onMouseEnter={() => setFoco(i)} onClick={() => ir(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === foco ? "bg-teal-500/10" : ""}`}>
                    <span className="w-20 shrink-0 font-mono text-[10px] uppercase text-neutral-500">{r.rotulo}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${i === foco ? "text-teal-200" : "text-neutral-200"}`}>{r.titulo}</span>
                    {marca === "todas" && r.marca && <span className="shrink-0 font-mono text-[9px] text-neutral-500">{nomeMarca(r.marca)}</span>}
                    {i === foco && <CornerDownLeft className="h-3 w-3 shrink-0 text-teal-400" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
