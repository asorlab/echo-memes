"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Radio, Sparkles, LogOut, X, ChevronDown, AudioLines, ImageIcon, Compass, Lightbulb, Trash2, Rss, FolderKanban, Users,
  Clapperboard, BarChart3, Dna, Type, Palette, BadgeCheck,
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

// Agrupamento aprovado no mapa de navegacao (P3, 30/09): LIBRARY/
// REFERENCE/STUDIO/SYSTEM. Fontes, Brand Assets e Paletas ja existiam como
// paginas mas nao tinham entrada nenhuma na sidebar (achado da auditoria) —
// entram aqui pela primeira vez. Templates deixou de ser item proprio: e
// filtro tipo="template" dentro de Visuais (mesma tabela, ver /visuais).
// "Refs" nao estava na lista que a Livia aprovou, mas continua existindo
// (regra de "nada desaparece") — mantive dentro de Reference.
const GRUPOS: GrupoNav[] = [
  {
    id: "library",
    rotulo: "Library",
    itens: [
      { id: "memes", nome: "Memes", icone: Sparkles, href: "/" },
      { id: "audios", nome: "Áudios", icone: AudioLines, href: "/audios" },
      { id: "visuais", nome: "Visuais", icone: ImageIcon, href: "/visuais" },
      { id: "fontes", nome: "Fontes", icone: Type, href: "/fontes" },
      { id: "brand", nome: "Brand Assets", icone: BadgeCheck, href: "/brand" },
      { id: "paletas", nome: "Paletas", icone: Palette, href: "/paletas" },
    ],
  },
  {
    id: "reference",
    rotulo: "Reference",
    itens: [
      { id: "contas", nome: "Contas", icone: Rss, href: "/contas" },
      { id: "edicoes-ref", nome: "Edits", icone: Compass, href: "/edicoes" },
      { id: "inspiracoes", nome: "Inspirações", icone: Lightbulb, href: "/inspiracoes" },
      { id: "refs", nome: "Refs", icone: Users, href: "/refs" },
    ],
  },
  {
    id: "studio",
    rotulo: "Studio",
    itens: [
      { id: "projetos", nome: "Projetos", icone: FolderKanban, href: "/projetos" },
      { id: "production", nome: "Production", icone: Clapperboard, href: "/production" },
      { id: "editing-dna", nome: "Editing DNA", icone: Dna, href: "/editing-dna" },
      { id: "analytics", nome: "Analytics", icone: BarChart3, href: "/analytics" },
    ],
  },
  {
    id: "system",
    rotulo: "System",
    itens: [
      { id: "lixeira", nome: "Lixeira", icone: Trash2, href: "/lixeira" },
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

  const grupoAtivoId = useMemo(() => {
    const item = GRUPOS.flatMap((g) => g.itens.map((i) => ({ ...i, grupoId: g.id })))
      .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
    return item?.grupoId ?? null;
  }, [pathname]);

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

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {GRUPOS.map((grupo) => {
            const aberto = grupoAtivoId === grupo.id || !colapsados.has(grupo.id);
            const painelId = `grupo-assets-${grupo.id}`;
            return (
              <div key={grupo.id}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.id)}
                  aria-expanded={aberto}
                  aria-controls={painelId}
                  className="flex w-full items-center justify-between rounded px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50"
                >
                  {grupo.rotulo}
                  <ChevronDown className={`h-3 w-3 transition-transform ${aberto ? "" : "-rotate-90"}`} />
                </button>
                {aberto && (
                  <div id={painelId} className="space-y-0.5">
                    {grupo.itens.map((item) => {
                      const Icone = item.icone;
                      const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <button
                          key={item.id}
                          onClick={() => { router.push(item.href); fechar(); }}
                          aria-current={ativo ? "page" : undefined}
                          className={`flex min-h-[40px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50 ${
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
