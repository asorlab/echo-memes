import { supabaseBrowser } from "@/lib/supabase/client";

// Bucket proprio pra raw footage (separado do "life-os" usado pelos
// assets pequenos) — vídeo bruto de vlog passa fácil de 50MB, e um
// limite maior so faz sentido pra esse tipo de arquivo especificamente,
// nao pro bucket inteiro. Ver supabase/migrations/0026_production.sql.
const BUCKET = "producao-raw";
const TIPOS_PERMITIDOS = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/x-matroska"];
const TAMANHO_MAXIMO_BYTES = 500 * 1024 * 1024; // 500MB — mesmo limite configurado no bucket

export async function enviarBruto(userId: string, arquivo: File): Promise<{ caminho: string; tamanhoBytes: number }> {
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new Error(`Tipo de arquivo nao permitido pra bruto: ${arquivo.type || "desconhecido"} (so video)`);
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error(`Arquivo maior que o limite (${Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024))}MB)`);
  }
  const supabase = supabaseBrowser();
  const { data: permitido, error: erroLimite } = await supabase.rpc("checar_rate_limit_upload");
  if (!erroLimite && permitido === false) {
    throw new Error("Muitos uploads em pouco tempo, tenta de novo em instantes");
  }
  const extensao = arquivo.name.split(".").pop();
  const caminho = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
  if (error) throw error;
  return { caminho, tamanhoBytes: arquivo.size };
}

export async function urlAssinadaBruto(caminho: string, expiraEmSeg = 3600): Promise<string | null> {
  const { data } = await supabaseBrowser().storage.from(BUCKET).createSignedUrl(caminho, expiraEmSeg);
  return data?.signedUrl ?? null;
}

export async function urlsAssinadasBrutos(caminhos: (string | null | undefined)[], expiraEmSeg = 3600): Promise<Record<string, string>> {
  const unicos = Array.from(new Set(caminhos.filter((c): c is string => !!c)));
  if (unicos.length === 0) return {};
  const { data } = await supabaseBrowser().storage.from(BUCKET).createSignedUrls(unicos, expiraEmSeg);
  const mapa: Record<string, string> = {};
  (data ?? []).forEach((d, i) => { if (d?.signedUrl) mapa[unicos[i]] = d.signedUrl; });
  return mapa;
}
