import { supabaseBrowser } from "./supabase/client";

const BUCKET = "life-os";

export async function enviarArquivo(pasta: string, userId: string, arquivo: File) {
  const supabase = supabaseBrowser();
  const extensao = arquivo.name.split(".").pop();
  const caminho = `${userId}/${pasta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  return data.publicUrl;
}
