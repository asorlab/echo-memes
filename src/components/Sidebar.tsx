"use client";

import { usePathname, useRouter } from "next/navigation";
import { Radio, Sparkles, LogOut, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface ItemNav {
  id: string;
  nome: string;
  icone: typeof Sparkles;
  href: string;
}

const ITENS: ItemNav[] = [
  { id: "memes", nome: "Memes", icone: Sparkles, href: "/" },
];

interface SidebarProps {
  aberta?: boolean;
  fechar?: () => void;
}

export default function Sidebar({ aberta = false, fechar = () => {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
          <span className="font-mono text-sm font-semibold tracking-tight text-neutral-100">ECHO // MEMES</span>
          <button onClick={fechar} className="ml-auto text-neutral-500 hover:text-neutral-300 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {ITENS.map((item) => {
            const Icone = item.icone;
            const ativo = pathname === item.href;
            return (
              <button
                key={item.id}
                onClick={() => { router.push(item.href); fechar(); }}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  ativo ? "bg-teal-500/10 text-teal-300" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <Icone className="h-4 w-4 shrink-0" />
                <span className="font-mono text-[13px]">{item.nome}</span>
                {ativo && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />}
              </button>
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
