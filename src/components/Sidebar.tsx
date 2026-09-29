"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Radio, Sparkles, LogOut, X, ChevronDown, AudioLines, ImageIcon, LayoutTemplate, Compass, Lightbulb, Trash2,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface ItemNav {
  id: string;
  nome: string;
  icone: typeof Sparkles;
  href: string;
}

interface GrupoNav {
  id: string;
  rotulo: string;
  itens: ItemNav[];
}

// Estrutura consolidada — poucas bibliotecas grandes, cada uma com tipos/
// tags/filtros internos (SFX vive dentro de Audios, Overlays/Transicoes/
// Presets vivem dentro de Visuais, Shots/Hooks vivem dentro de
// Inspiracoes), em vez de uma pagina pra cada subtipo.
const GRUPOS: GrupoNav[] = [
  {
    id: "edicao",
    rotulo: "Edição",
    itens: [
      { id: "memes", nome: "Memes", icone: Sparkles, href: "/" },
      { id: "audios", nome: "Áudios", icone: AudioLines, href: "/audios" },
      { id: "visuais", nome: "Visuais", icone: ImageIcon, href: "/visuais" },
      { id: "templates", nome: "Templates", icone: LayoutTemplate, href: "/templates" },
    ],
  },
  {
    id: "referencias",
    rotulo: "Referências",
    itens: [
      { id: "edicoes-ref", nome: "Edits", icone: Compass, href: "/edicoes" },
      { id: "inspiracoes", nome: "Inspirações", icone: Lightbulb, href: "/inspiracoes" },
    ],
  },
];

const CHAVE_COLAPSADOS = "echo-assets:grupos-colapsados";

interface SidebarProps {
  aberta?: boolean;
  fechar?: () => void;
}

export default function Sidebar({ aberta = false, fechar = () => {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_COLAPSADOS);
      if (salvo) setColapsados(new Set(JSON.parse(salvo)));
    } catch { /* ignora */ }
  }, []);

  function alternarGrupo(id: string) {
    setColapsados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      try { window.localStorage.setItem(CHAVE_COLAPSADOS, JSON.stringify(Array.from(novo))); } catch { /* ignora */ }
      return novo;
    });
  }

  async function sair() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
  }

  function conteudo() {
    return (
      <div className="flex h-full flex-col bg-neutral-950">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
            <Radio className="h-4 w-4" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-neutral-100">ECHO // ASSETS</span>
          <button onClick={fechar} className="ml-auto shrink-0 text-neutral-500 hover:text-neutral-300 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => {
            const aberto = !colapsados.has(grupo.id);
            return (
              <div key={grupo.id}>
                <button
                  onClick={() => alternarGrupo(grupo.id)}
                  className="mb-1 flex w-full items-center justify-between px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-400"
                >
                  {grupo.rotulo}
                  <ChevronDown className={`h-3 w-3 transition-transform ${aberto ? "" : "-rotate-90"}`} />
                </button>
                {aberto && (
                  <div className="space-y-0.5">
                    {grupo.itens.map((item) => {
                      const Icone = item.icone;
                      const ativo = pathname === item.href;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { router.push(item.href); fechar(); }}
                          className={`flex min-h-[40px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            ativo ? "bg-teal-500/10 text-teal-300" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                          }`}
                        >
                          <Icone className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono text-[13px]">{item.nome}</span>
                          {ativo && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-neutral-800 px-3 py-3">
          <button
            onClick={() => { router.push("/lixeira"); fechar(); }}
            className={`flex min-h-[40px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === "/lixeira" ? "bg-teal-500/10 text-teal-300" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="font-mono text-[13px]">Lixeira</span>
          </button>
          <button
            onClick={sair}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-mono text-[13px]">Sair</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden w-60 shrink-0 border-r border-neutral-800 md:block">{conteudo()}</div>
      {aberta && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={fechar} />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-neutral-800">{conteudo()}</div>
        </div>
      )}
    </>
  );
}
