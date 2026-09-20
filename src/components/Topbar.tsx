"use client";

import { Menu } from "lucide-react";

interface TopbarProps {
  titulo: string;
  abrirMenu: () => void;
}

export default function Topbar({ titulo, abrirMenu }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-800 px-4 md:hidden">
      <button onClick={abrirMenu} className="flex h-11 w-11 items-center justify-center text-neutral-400 hover:text-neutral-200">
        <Menu className="h-5 w-5" />
      </button>
      <span className="font-mono text-sm font-medium text-neutral-200">{titulo}</span>
    </header>
  );
}
