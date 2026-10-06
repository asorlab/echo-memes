// Papeis e acesso por area. Mesma regra do echo-os-app (mesmo projeto
// Supabase): fonte da verdade e o app_metadata do Supabase Auth, que so o
// servidor (service role) consegue alterar.
//
//   app_metadata.papel   = "admin" | "convidado"
//   app_metadata.espacos = [..., "assets"]
//
// ADMIN_EMAILS (variavel de servidor, separada por virgula) e a rede de
// seguranca enquanto o app_metadata da admin nao estiver gravado.
// Roda no Edge (middleware), entao nao importa nada de Node.

type UsuarioMinimo = { email?: string | null; app_metadata?: Record<string, unknown> | null };

function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function ehAdmin(user: UsuarioMinimo | null | undefined): boolean {
  if (!user) return false;
  if (user.app_metadata?.papel === "admin") return true;
  return !!user.email && emailsAdmin().includes(user.email.toLowerCase());
}

export function podeUsarAssets(user: UsuarioMinimo | null | undefined): boolean {
  if (ehAdmin(user)) return true;
  const espacos = user?.app_metadata?.espacos;
  return Array.isArray(espacos) && espacos.includes("assets");
}
