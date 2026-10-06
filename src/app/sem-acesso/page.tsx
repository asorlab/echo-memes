import Link from "next/link";
import { Radio } from "lucide-react";

export const metadata = { title: "Sem acesso · ECHO // ASSETS", robots: { index: false, follow: false } };

// 403 com a marca, sem dizer o que existe por tras da rota.
export default function SemAcesso({ searchParams }: { searchParams: { motivo?: string } }) {
  const mfa = searchParams.motivo === "mfa";
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 font-sans text-neutral-200">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-center">
        <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
          <Radio className="h-4 w-4" aria-hidden />
        </div>
        <p className="font-mono text-xs tracking-widest text-neutral-500">403</p>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">
          {mfa ? "Ative a verificação em dois fatores" : "Você não tem acesso a esta área"}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {mfa
            ? "Contas de administração precisam do app autenticador. Ative em ECHO, na tela Segurança, e entre de novo."
            : "Se acha que deveria ter, peça um convite para quem administra o ECHO."}
        </p>
        <Link href="/login" className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md border border-neutral-800 px-4 text-sm text-neutral-300 hover:text-neutral-100">
          Entrar com outra conta
        </Link>
      </div>
    </main>
  );
}
