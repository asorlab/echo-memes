import { NextRequest, NextResponse } from "next/server";
import { auditar, dentroDoLimite, lerCorpo, origemDaRequisicao, supabaseRota } from "@/lib/server/servidor";

// Login pelo servidor: rate limit por IP e por e-mail, bloqueio temporario
// e auditoria. A sessao volta em cookie, lida depois pelo middleware.
// As chaves de limite sao as mesmas do echo-os-app (mesma conta, mesmo
// banco), entao tentar pelos dois apps soma no mesmo contador.

const JANELA = 15 * 60;
const MSG_BLOQUEIO = "Muitas tentativas. Por segurança, o acesso ficou bloqueado por 15 minutos.";

export async function POST(request: NextRequest) {
  const corpo = lerCorpo(await request.json().catch(() => null), true);
  if (!corpo) return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });
  const { email, senha, captchaToken } = corpo;
  const { ip, pais } = origemDaRequisicao(request);

  const [porEmail, porIp] = await Promise.all([
    dentroDoLimite(`login:email:${email}`, 6, JANELA),
    dentroDoLimite(`login:ip:${ip}`, 20, JANELA),
  ]);
  if (!porEmail || !porIp) {
    await auditar("login_bloqueado", null, { email, ip, pais, motivo: !porEmail ? "email" : "ip" });
    return NextResponse.json({ erro: MSG_BLOQUEIO }, { status: 429 });
  }

  const { data, error } = await supabaseRota().auth.signInWithPassword({
    email,
    password: senha,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error || !data.user) {
    await auditar("login_falhou", null, { email, ip, pais, motivo: error?.code ?? error?.message ?? "desconhecido" });
    // Mensagem unica: nao revela se o e-mail existe.
    const captcha = error?.message?.toLowerCase().includes("captcha");
    return NextResponse.json({ erro: captcha ? "Confirme que você não é um robô e tente de novo." : "E-mail ou senha incorretos." }, { status: 401 });
  }

  await auditar("login_ok", data.user.id, { ip, pais });
  return NextResponse.json({ ok: true });
}
