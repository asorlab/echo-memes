"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <FormularioLogin />
    </Suspense>
  );
}

type Modo = "entrar" | "criar-conta" | "esqueci-senha" | "nova-senha";

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proximaRota = searchParams.get("next") || "/";
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const codigo = searchParams.get("code");
    if (codigo) {
      supabase.auth.exchangeCodeForSession(codigo).then(({ error }) => {
        if (error) setErro("Link de redefinicao invalido ou expirado. Peca um novo.");
        else {
          setSenha("");
          setAviso("");
          setModo("nova-senha");
        }
      });
    }

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") {
        setSenha("");
        setErro("");
        setAviso("");
        setModo("nova-senha");
      }
    });
    return () => assinatura.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpar(proximoModo: Modo) {
    setModo(proximoModo);
    setErro("");
    setAviso("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setCarregando(true);
    const supabase = supabaseBrowser();
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro(error.message);
      else router.replace(proximaRota);
    } else if (modo === "criar-conta") {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) setErro(error.message);
      else setAviso("Conta criada. Verifique seu e-mail para confirmar o acesso.");
    } else if (modo === "esqueci-senha") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) setErro(error.message);
      else setAviso("Se esse e-mail tiver uma conta, enviamos um link de redefinição. Confira sua caixa de entrada.");
    } else {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) setErro(error.message);
      else {
        setAviso("Senha atualizada! Entrando...");
        router.replace(proximaRota);
      }
    }
    setCarregando(false);
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950 px-4 font-sans text-neutral-200">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
            <Radio className="h-4 w-4" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-neutral-100">ECHO // MEMES</span>
        </div>

        {modo === "nova-senha" && (
          <p className="mb-3 text-xs text-neutral-500">Escolha uma nova senha para sua conta.</p>
        )}

        <form onSubmit={enviar} className="space-y-3">
          {modo !== "nova-senha" && (
            <div>
              <label className="mb-1 block text-xs text-neutral-500">E-mail</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-teal-500/40"
              />
            </div>
          )}
          {modo !== "esqueci-senha" && (
            <div>
              <label className="mb-1 block text-xs text-neutral-500">{modo === "nova-senha" ? "Nova senha" : "Senha"}</label>
              <input
                type="password"
                required
                autoFocus={modo === "nova-senha"}
                minLength={10}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-teal-500/40"
              />
            </div>
          )}

          {erro && <p className="text-xs text-[#F0997B]">{erro}</p>}
          {aviso && <p className="text-xs text-[#5DCAA5]">{aviso}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="min-h-[44px] w-full rounded-md bg-teal-500 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {modo === "entrar" && "Entrar"}
            {modo === "criar-conta" && "Criar conta"}
            {modo === "esqueci-senha" && "Enviar link de redefinição"}
            {modo === "nova-senha" && "Salvar nova senha"}
          </button>
        </form>

        {modo === "entrar" && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <button onClick={() => limpar("criar-conta")} className="min-h-[32px] text-center text-xs text-neutral-500 hover:text-neutral-300">
              Não tem conta? Criar uma
            </button>
            <button onClick={() => limpar("esqueci-senha")} className="min-h-[32px] text-center text-xs text-neutral-500 hover:text-neutral-300">
              Esqueci minha senha
            </button>
          </div>
        )}
        {modo === "criar-conta" && (
          <button onClick={() => limpar("entrar")} className="mt-4 min-h-[44px] w-full text-center text-xs text-neutral-500 hover:text-neutral-300">
            Já tem conta? Entrar
          </button>
        )}
        {modo === "esqueci-senha" && (
          <button onClick={() => limpar("entrar")} className="mt-4 min-h-[44px] w-full text-center text-xs text-neutral-500 hover:text-neutral-300">
            Voltar para login
          </button>
        )}
      </div>
    </div>
  );
}
