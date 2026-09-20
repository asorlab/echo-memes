"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ToastProvider from "@/components/ToastProvider";
import { useUser } from "@/lib/useUser";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, carregando, naoConfigurado } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarAberta, setSidebarAberta] = useState(false);

  const naPaginaDeLogin = pathname === "/login";

  useEffect(() => {
    if (!carregando && !naoConfigurado && !user && !naPaginaDeLogin) router.replace("/login");
  }, [carregando, user, naoConfigurado, naPaginaDeLogin, router]);

  if (naoConfigurado) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950 px-4 font-sans text-neutral-200">
        <div className="max-w-md rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-center">
          <p className="mb-2 font-mono text-sm font-semibold text-neutral-100">Supabase nao configurado</p>
          <p className="text-sm text-neutral-500">
            Defina <code className="text-neutral-300">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="text-neutral-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em .env.local.
          </p>
        </div>
      </div>
    );
  }

  if (naPaginaDeLogin) return <>{children}</>;

  if (carregando || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950 font-mono text-sm text-neutral-500">
        Carregando...
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-full overflow-hidden bg-neutral-950 font-sans text-neutral-200" lang="pt-BR">
        <Sidebar aberta={sidebarAberta} fechar={() => setSidebarAberta(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar titulo="ECHO // MEMES" abrirMenu={() => setSidebarAberta(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
