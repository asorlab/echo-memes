import { NextRequest, NextResponse } from "next/server";
import { auditar, dentroDoLimite, lerCorpo, origemDaRequisicao, supabaseRota } from "@/lib/server/servidor";

// "Esqueci minha senha" pelo servidor: rate limit por e-mail e por IP e
// resposta sempre igual (nao revela se a conta existe).

const RESPOSTA = "Se esse e-mail tiver uma conta, enviamos um link de redefinição. Confira sua caixa de entrada.";

export async function POST(request: NextRequest) {
  const corpo = lerCorpo(await request.json().catch(() => null), false);
  if (!corpo) return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });
  const { email, captchaToken } = corpo;
  const { ip, pais } = origemDaRequisicao(request);

  const [porEmail, porIp] = await Promise.all([
    dentroDoLimite(`reset:email:${email}`, 3, 3600),
    dentroDoLimite(`reset:ip:${ip}`, 10, 3600),
  ]);
  if (!porEmail || !porIp) {
    await auditar("reset_bloqueado", null, { email, ip, pais });
    return NextResponse.json({ erro: "Muitos pedidos. Tente de novo em uma hora." }, { status: 429 });
  }

  const origem = new URL(request.url).origin;
  const { error } = await supabaseRota().auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/login`,
    captchaToken,
  });
  if (error?.message?.toLowerCase().includes("captcha")) {
    return NextResponse.json({ erro: "Confirme que você não é um robô e tente de novo." }, { status: 400 });
  }
  await auditar("reset_pedido", null, { email, ip, pais });
  return NextResponse.json({ ok: true, aviso: RESPOSTA });
}
