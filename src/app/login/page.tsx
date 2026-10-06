"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { nivelAal, iniciarDesafioLogin, confirmarDesafioLogin } from "@/lib/mfaChallenge";
import { rotaInternaSegura } from "@/lib/rotaSegura";

// Login do ECHO // ASSETS. Sem cadastro publico: contas novas so entram por
// convite da admin. Entrar e "esqueci a senha" passam pelo servidor
// (/api/auth/*), que aplica rate limit, bloqueio temporario e auditoria.
// Turnstile (Cloudflare) protege os dois formularios quando a
// NEXT_PUBLIC_TURNSTILE_SITE_KEY e o CAPTCHA do Supabase Auth estao ligados.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <FormularioLogin />
    </Suspense>
  );
}

type Modo = "entrar" | "esqueci-senha" | "nova-senha" | "mfa";

const CAMPO =
  "min-h-[44px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-teal-500/40";
const BOTAO_SECUNDARIO = "min-h-[44px] w-full text-center text-xs text-neutral-500 hover:text-neutral-300";

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proximaRota = rotaInternaSegura(searchParams.get("next"), "/");

  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [captchaPronto, setCaptchaPronto] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaWidgetId = useRef<string | undefined>(undefined);
  const captchaContainerRef = useRef<HTMLDivElement>(null);

  const [codigoMfa, setCodigoMfa] = useState("");
  const [desafioMfa, setDesafioMfa] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [erroMfa, setErroMfa] = useState("");
  const [verificandoMfa, setVerificandoMfa] = useState(false);

  async function iniciarMfaSeNecessario(): Promise<boolean> {
    const nivel = await nivelAal();
    if (nivel.proximo === "aal2" && nivel.atual !== "aal2") {
      const desafio = await iniciarDesafioLogin();
      setDesafioMfa(desafio);
      setModo("mfa");
      return true;
    }
    return false;
  }

  async function confirmarMfa() {
    if (!desafioMfa || codigoMfa.trim().length < 6) return;
    setVerificandoMfa(true);
    setErroMfa("");
    try {
      await confirmarDesafioLogin(desafioMfa.factorId, desafioMfa.challengeId, codigoMfa.trim());
      router.replace(proximaRota);
    } catch {
      setErroMfa("Código incorreto: confira o app autenticador e tente de novo");
      setCodigoMfa("");
    } finally {
      setVerificandoMfa(false);
    }
  }

  function renderizarCaptcha() {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !captchaContainerRef.current) return;
    captchaContainerRef.current.innerHTML = "";
    captchaWidgetId.current = window.turnstile.render(captchaContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      theme: "dark",
    });
  }

  useEffect(() => {
    const supabase = supabaseBrowser();

    // Sessao aal1 numa conta que exige aal2 (o middleware mandou de volta
    // pra ca): vai direto ao desafio, sem pedir senha de novo.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) iniciarMfaSeNecessario().catch(() => {});
    });

    // Link de redefinicao (PKCE): chega como ?code=...
    const codigo = searchParams.get("code");
    if (codigo) {
      supabase.auth.exchangeCodeForSession(codigo).then(({ error }) => {
        if (error) setErro("Link de redefinição inválido ou expirado. Peça um novo.");
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

  useEffect(() => {
    if (captchaPronto && modo !== "nova-senha" && modo !== "mfa") renderizarCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captchaPronto, modo]);

  function limpar(proximoModo: Modo) {
    setModo(proximoModo);
    setErro("");
    setAviso("");
  }

  async function postar(url: string, corpo: Record<string, unknown>) {
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const dados = (await resp.json().catch(() => ({}))) as { erro?: string; aviso?: string };
    return { ok: resp.ok, ...dados };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    if (TURNSTILE_SITE_KEY && modo !== "nova-senha" && !captchaToken) {
      setErro("Confirme que você não é um robô.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const r = await postar("/api/auth/entrar", { email, senha, captchaToken: captchaToken || undefined });
        if (!r.ok) setErro(r.erro ?? "Não foi possível entrar agora.");
        else {
          // A sessao ja esta no cookie: o cliente do navegador passa a enxerga-la.
          await supabaseBrowser().auth.getSession();
          const precisaMfa = await iniciarMfaSeNecessario();
          if (!precisaMfa) router.replace(proximaRota);
        }
      } else if (modo === "esqueci-senha") {
        const r = await postar("/api/auth/esqueci", { email, captchaToken: captchaToken || undefined });
        if (!r.ok) setErro(r.erro ?? "Não foi possível enviar agora.");
        else setAviso(r.aviso ?? "Se esse e-mail tiver uma conta, enviamos um link de redefinição.");
      } else if (modo === "nova-senha") {
        const { error } = await supabaseBrowser().auth.updateUser({ password: senha });
        if (error) setErro("Não foi possível salvar a nova senha. Use pelo menos 10 caracteres.");
        else {
          setAviso("Senha atualizada! Entrando...");
          router.replace(proximaRota);
        }
      }
    } finally {
      setCarregando(false);
      setCaptchaToken("");
      if (TURNSTILE_SITE_KEY && window.turnstile && captchaWidgetId.current) window.turnstile.reset(captchaWidgetId.current);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4 font-sans text-neutral-200">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
            <Radio className="h-4 w-4" aria-hidden />
          </div>
          <h1 className="font-mono text-sm font-semibold tracking-tight text-neutral-100">ECHO // ASSETS</h1>
        </div>

        {modo === "mfa" ? (
          <form onSubmit={(e) => { e.preventDefault(); confirmarMfa(); }} className="space-y-3">
            <label htmlFor="codigo-mfa" className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" aria-hidden /> Código do seu app autenticador
            </label>
            <input
              id="codigo-mfa"
              name="codigo"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              value={codigoMfa}
              onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${CAMPO} text-center font-mono text-lg tracking-[0.3em]`}
            />
            {erroMfa && <p role="alert" className="text-xs text-[#F0997B]">{erroMfa}</p>}
            <button
              type="submit"
              disabled={codigoMfa.trim().length < 6 || verificandoMfa}
              className="min-h-[44px] w-full rounded-md bg-teal-500 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verificandoMfa ? "Verificando..." : "Confirmar"}
            </button>
          </form>
        ) : (
          <>
            {modo === "nova-senha" && <p className="mb-3 text-xs text-neutral-500">Escolha uma nova senha para sua conta.</p>}

            <form onSubmit={enviar} className="space-y-3">
              {modo !== "nova-senha" && (
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs text-neutral-500">E-mail</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={CAMPO}
                  />
                </div>
              )}
              {modo !== "esqueci-senha" && (
                <div>
                  <label htmlFor="senha" className="mb-1 block text-xs text-neutral-500">{modo === "nova-senha" ? "Nova senha" : "Senha"}</label>
                  <input
                    id="senha"
                    name="password"
                    type="password"
                    autoComplete={modo === "nova-senha" ? "new-password" : "current-password"}
                    required
                    autoFocus={modo === "nova-senha"}
                    minLength={modo === "nova-senha" ? 10 : 1}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={CAMPO}
                  />
                </div>
              )}

              {/* Altura reservada: o botao nao pula quando o Turnstile termina de carregar. */}
              {TURNSTILE_SITE_KEY && modo !== "nova-senha" && <div ref={captchaContainerRef} className="min-h-[65px]" />}

              {erro && <p role="alert" className="text-xs text-[#F0997B]">{erro}</p>}
              {aviso && <p role="status" className="text-xs text-[#5DCAA5]">{aviso}</p>}

              <button
                type="submit"
                disabled={carregando}
                className="min-h-[44px] w-full rounded-md bg-teal-500 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {modo === "entrar" && (carregando ? "Entrando..." : "Entrar")}
                {modo === "esqueci-senha" && "Enviar link de redefinição"}
                {modo === "nova-senha" && "Salvar nova senha"}
              </button>
            </form>

            {modo === "entrar" && (
              <div className="mt-4 flex flex-col items-center">
                <button type="button" onClick={() => limpar("esqueci-senha")} className={BOTAO_SECUNDARIO}>
                  Esqueci minha senha
                </button>
                <p className="mt-1 text-center text-[11px] text-neutral-600">Acesso só por convite.</p>
              </div>
            )}
            {modo === "esqueci-senha" && (
              <button type="button" onClick={() => limpar("entrar")} className={`mt-4 ${BOTAO_SECUNDARIO}`}>
                Voltar para o login
              </button>
            )}
          </>
        )}
      </div>

      {TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onLoad={() => setCaptchaPronto(true)} />
      )}
    </main>
  );
}
