"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Radio, Sparkles, LogOut, X, ChevronDown, Volume2, AudioLines, Layers,
  ArrowRightLeft, SlidersHorizontal, LayoutTemplate, Type, Gem, Palette,
  Compass, Camera, Anchor, Lightbulb,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface ItemNav {
  id: string;
  nome: string;
  icone: typeof Sparkles;
  href: string | null;
}

interface GrupoNav {
  id: string;
  rotulo: string;
  itens: ItemNav[];
}

// So "Memes" esta implementado por enquanto — o resto e a arquitetura de
// navegacao da biblioteca preparada de antemao. Cada secao vai ganhar campos
// e comportamento proprios quando for construida (nao e so aplicar os
// campos de Memes em tudo — um SFX, uma fonte e um meme sao coisas
// diferentes). Adicionar uma biblioteca nova = so acrescentar um item aqui.
const GRUPOS: GrupoNav[] = [
  {
    id: "edicao",
    rotulo: "Edição",
    itens: [
      { id: "memes", nome: "Memes", icone: Sparkles, href: "/" },
      { id: "sfx", nome: "SFX", icone: Volume2, href: "/sfx" },
      { id: "audios", nome: "Áudios", icone: AudioLines, href: "/audios" },
      { id: "overlays", nome: "Overlays", icone: Layers, href: "/overlays" },
      { id: "transicoes", nome: "Transições", icone: ArrowRightLeft, href: "/transicoes" },
      { id: "presets", nome: "Presets", icone: SlidersHorizontal, href: "/presets" },
      { id: "templates", nome: "Templates", icone: LayoutTemplate, href: "/templates" },
    ],
  },
  {
    id: "identidade",
    rotulo: "Identidade",
    itens: [
      { id: "fontes", nome: "Fontes", icone: Type, href: "/fontes" },
      { id: "brand", nome: "Brand Assets", icone: Gem, href: "/brand" },
      { id: "paletas", nome: "Paletas/Looks", icone: Palette, href: "/paletas" },
    ],
  },
  {
    id: "referencias",
    rotulo: "Referências",
    itens: [
      { id: "edicoes-ref", nome: "Edições", icone: Compass, href: "/edicoes" },
      { id: "shots", nome: "Shots", icone: Camera, href: "/shots" },
      { id: "hooks", nome: "Hooks", icone: Anchor, href: "/hooks" },
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
          <div className="min-w-0">
            <span className="block font-mono text-sm font-semibold tracking-tight text-neutral-100">ECHO // ASSETS</span>
            <span className="block truncate text-[10px] text-neutral-600">Biblioteca criativa</span>
          </div>
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
                      const ativo = item.href !== null && pathname === item.href;
                      const disponivel = item.href !== null;
                      return (
                        <button
                          key={item.id}
                          disabled={!disponivel}
                          onClick={() => { if (item.href) { router.push(item.href); fechar(); } }}
                          className={`flex min-h-[40px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            ativo ? "bg-teal-500/10 text-teal-300" :
                            disponivel ? "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200" :
                            "cursor-default text-neutral-700"
                          }`}
                        >
                          <Icone className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono text-[13px]">{item.nome}</span>
                          {ativo && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />}
                          {!disponivel && <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-neutral-700">em breve</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-neutral-800 px-3 py-3">
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
