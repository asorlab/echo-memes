import { supabaseBrowser } from "./supabase/client";

// So o lado de DESAFIO do MFA (o enroll fica no echo-os-app, em
// "Segurança" — mesma conta, mesmo projeto Supabase, um so lugar pra
// ativar/desativar). Aqui so precisa reconhecer que a conta tem MFA e
// pedir o codigo no login, senao esse app vira uma porta lateral que
// dribla o segundo fator.

export interface NivelAal {
  atual: string | null;
  proximo: string | null;
}

export async function nivelAal(): Promise<NivelAal> {
  const { data, error } = await supabaseBrowser().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return { atual: data.currentLevel, proximo: data.nextLevel };
}

export async function iniciarDesafioLogin(): Promise<{ factorId: string; challengeId: string }> {
  const { data: fatores, error: erroFatores } = await supabaseBrowser().auth.mfa.listFactors();
  if (erroFatores) throw erroFatores;
  const fator = fatores?.totp.find((f) => f.status === "verified");
  if (!fator) throw new Error("Nenhum fator MFA verificado encontrado");
  const { data, error } = await supabaseBrowser().auth.mfa.challenge({ factorId: fator.id });
  if (error) throw error;
  return { factorId: fator.id, challengeId: data.id };
}

export async function confirmarDesafioLogin(factorId: string, challengeId: string, codigo: string): Promise<void> {
  const { error } = await supabaseBrowser().auth.mfa.verify({ factorId, challengeId, code: codigo });
  if (error) throw error;
}
