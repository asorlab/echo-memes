"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, ExternalLink, Sparkles, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo } from "@/lib/storage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import type { Meme } from "@/lib/types";

interface MemeRow {
  id: string; user_id: string; titulo: string; imagem_url: string | null;
  link_origem: string | null; explicacao: string; tags: string[]; created_at: string;
}

function mapMeme(r: MemeRow): Meme {
  return { id: r.id, titulo: r.titulo, imagemUrl: r.imagem_url, linkOrigem: r.link_origem, explicacao: r.explicacao, tags: r.tags ?? [], criadoEm: r.created_at };
}

function paraListaDeTags(valor: string): string[] {
  return valor.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
}
function paraTextoDeTags(lista: string[]): string {
  return lista.join(", ");
}

export default function MemesPage() {
  const { user } = useUser();
  const toast = useToast();
  const [memes, setMemes] = useState<Meme[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tagAtiva, setTagAtiva] = useState<string | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [imagensQuebradas, setImagensQuebradas] = useState<Set<string>>(new Set());

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    const { data } = await supabase.from("memes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMemes(((data as MemeRow[]) ?? []).map(mapMeme));
    setCarregando(false);
    primeiraCarga.current = false;
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar() {
    if (!user) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").insert({ user_id: user.id, titulo: "Novo meme", explicacao: "" });
    if (error) { toast("Erro ao criar"); return; }
    carregar();
  }

  async function atualizar(id: string, patch: Partial<{ titulo: string; imagem_url: string | null; link_origem: string | null; explicacao: string; tags: string[] }>) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").delete().eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Meme removido");
    carregar();
  }

  async function enviarImagem(id: string, arquivo: File) {
    if (!user) return;
    setEnviandoId(id);
    try {
      const url = await enviarArquivo("memes", user.id, arquivo);
      await atualizar(id, { imagem_url: url });
    } catch {
      toast("Erro ao enviar imagem");
    } finally {
      setEnviandoId(null);
    }
  }

  const todasAsTags = Array.from(new Set(memes.flatMap((m) => m.tags))).sort();
  const filtrados = memes.filter((m) => {
    if (tagAtiva && !m.tags.includes(tagAtiva)) return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return m.titulo.toLowerCase().includes(alvo) || m.explicacao.toLowerCase().includes(alvo) || m.tags.some((t) => t.includes(alvo));
  });

  return (
    <div>
      <PageHeader
        titulo="Memes"
        descricao="Cada meme, de onde veio e por que funciona."
        acao={
          <button onClick={adicionar} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo meme
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título, explicação ou tag…"
          className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
        />
      </div>

      {todasAsTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagAtiva(null)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!tagAtiva ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
          >
            Todas
          </button>
          {todasAsTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagAtiva(t === tagAtiva ? null : t)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${tagAtiva === t ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={Sparkles}
          titulo={memes.length === 0 ? "Nenhum meme guardado ainda" : "Nenhum meme encontrado"}
          descricao={memes.length === 0 ? "Clique em “Novo meme” pra começar o acervo." : "Tente buscar por outro termo ou tag."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((m) => (
            <Card key={m.id} className="overflow-hidden p-0">
              <button
                onClick={() => fileInputRefs.current[m.id]?.click()}
                className="relative flex aspect-square w-full items-center justify-center bg-neutral-900"
              >
                {m.imagemUrl && !imagensQuebradas.has(m.imagemUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imagemUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setImagensQuebradas((atual) => new Set(atual).add(m.imagemUrl!))}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-neutral-700">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-[10px]">Clique pra enviar imagem</span>
                  </div>
                )}
                {enviandoId === m.id && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-neutral-300">Enviando...</span>}
              </button>
              <input
                ref={(el) => { fileInputRefs.current[m.id] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(m.id, f); e.target.value = ""; }}
              />

              <div className="space-y-2 p-3.5">
                <EditableField value={m.titulo} onSave={(v) => atualizar(m.id, { titulo: v })} displayClassName="text-sm font-semibold text-neutral-100" />

                <div>
                  <p className="text-[9px] uppercase tracking-wide text-neutral-700">Por que funciona</p>
                  <EditableField
                    as="textarea"
                    value={m.explicacao}
                    placeholder="Escreva por que esse meme pega…"
                    onSave={(v) => atualizar(m.id, { explicacao: v })}
                    displayClassName="text-xs leading-relaxed text-neutral-400"
                  />
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wide text-neutral-700">Link de origem</p>
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <EditableField
                        value={m.linkOrigem ?? ""}
                        placeholder="https://..."
                        onSave={(v) => atualizar(m.id, { link_origem: v || null })}
                        displayClassName="truncate text-[11px] text-neutral-500"
                      />
                    </div>
                    {m.linkOrigem && (
                      <a href={m.linkOrigem} target="_blank" rel="noreferrer" className="shrink-0 text-neutral-600 hover:text-teal-400">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-wide text-neutral-700">Tags</p>
                  <EditableField
                    value={paraTextoDeTags(m.tags)}
                    placeholder="ex.: anime, bbb, copa"
                    onSave={(v) => atualizar(m.id, { tags: paraListaDeTags(v) })}
                    displayClassName="text-[11px] text-teal-500/80"
                  />
                </div>

                <div className="flex justify-end pt-0.5">
                  <button onClick={() => { if (window.confirm("Excluir este meme?")) excluir(m.id); }} className="flex h-7 w-7 items-center justify-center text-neutral-600 hover:text-[#F0997B]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
