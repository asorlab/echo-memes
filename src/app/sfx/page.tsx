"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Volume2, Search, Download, Star, X, History, ExternalLink,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo } from "@/lib/storage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import type { CategoriaSfx, Momento, Risco, Sfx, SfxUso } from "@/lib/types";

interface SfxRow {
  id: string; titulo: string; arquivo_url: string | null; categoria: CategoriaSfx | null;
  momento: Momento | null; risco: Risco | null; duracao_seg: number | null; tags: string[];
  link_origem: string | null; favorito: boolean; created_at: string;
}
interface SfxUsoRow { id: string; sfx_id: string; contexto: string; data: string; }

function mapSfx(r: SfxRow): Sfx {
  return {
    id: r.id, titulo: r.titulo, arquivoUrl: r.arquivo_url, categoria: r.categoria, momento: r.momento,
    risco: r.risco, duracaoSeg: r.duracao_seg, tags: r.tags ?? [], linkOrigem: r.link_origem,
    favorito: r.favorito, criadoEm: r.created_at,
  };
}
function mapUso(r: SfxUsoRow): SfxUso {
  return { id: r.id, sfxId: r.sfx_id, contexto: r.contexto, data: r.data };
}

const CATEGORIAS: { id: CategoriaSfx; rotulo: string }[] = [
  { id: "whoosh", rotulo: "Whoosh" }, { id: "impacto", rotulo: "Impacto" }, { id: "notificacao", rotulo: "Notificação" },
  { id: "transicao", rotulo: "Transição" }, { id: "risada", rotulo: "Risada" }, { id: "erro", rotulo: "Erro" },
  { id: "sucesso", rotulo: "Sucesso" }, { id: "ambiente", rotulo: "Ambiente" }, { id: "outro", rotulo: "Outro" },
];
const MOMENTOS: { id: Momento; rotulo: string }[] = [
  { id: "gancho", rotulo: "Gancho" }, { id: "transicao", rotulo: "Transição" }, { id: "punchline", rotulo: "Punchline" }, { id: "fecho", rotulo: "Fecho" },
];
const RISCOS: { id: Risco; rotulo: string }[] = [
  { id: "baixo", rotulo: "Baixo" }, { id: "medio", rotulo: "Médio" }, { id: "alto", rotulo: "Alto" },
];

function extrairDuracaoAudio(arquivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { URL.revokeObjectURL(audio.src); resolve(Number.isFinite(audio.duration) ? audio.duration : null); };
    audio.onerror = () => { URL.revokeObjectURL(audio.src); resolve(null); };
    audio.src = URL.createObjectURL(arquivo);
  });
}

export default function SfxPage() {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<Sfx[]>([]);
  const [usos, setUsos] = useState<SfxUso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaSfx | null>(null);
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [novoUso, setNovoUso] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    const [{ data }, { data: usosData }] = await Promise.all([
      supabase.from("sfx").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("sfx_usos").select("*").eq("user_id", user.id).order("data", { ascending: false }),
    ]);
    setItens(((data as SfxRow[]) ?? []).map(mapSfx));
    setUsos(((usosData as SfxUsoRow[]) ?? []).map(mapUso));
    setCarregando(false);
    primeiraCarga.current = false;
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarArquivos(arquivos: FileList) {
    if (!user) return;
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const [url, duracao] = await Promise.all([
          enviarArquivo("sfx", user.id, arquivo),
          extrairDuracaoAudio(arquivo),
        ]);
        const titulo = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Novo SFX";
        await supabaseBrowser().from("sfx").insert({
          user_id: user.id, titulo, arquivo_url: url,
          duracao_seg: duracao ? Math.round(duracao * 10) / 10 : null,
        });
      }
      toast(arquivos.length > 1 ? `${arquivos.length} SFX adicionados` : "SFX adicionado");
      carregar();
    } catch {
      toast("Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  async function atualizar(id: string, patch: Partial<{
    titulo: string; categoria: CategoriaSfx | null; momento: Momento | null; risco: Risco | null;
    tags: string[]; link_origem: string | null; favorito: boolean;
  }>) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("sfx").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("sfx").delete().eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("SFX removido");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  async function registrarUso(sfxId: string, contexto: string) {
    if (!user || !contexto.trim()) return;
    const supabase = supabaseBrowser();
    await supabase.from("sfx_usos").insert({ sfx_id: sfxId, user_id: user.id, contexto: contexto.trim() });
    setNovoUso("");
    carregar();
  }
  async function excluirUso(id: string) {
    await supabaseBrowser().from("sfx_usos").delete().eq("id", id);
    carregar();
  }

  async function baixar(item: Sfx) {
    if (!item.arquivoUrl) return;
    try {
      const resposta = await fetch(item.arquivoUrl);
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const extensao = item.arquivoUrl.split("?")[0].split(".").pop() || "mp3";
      const nome = `${(item.categoria ?? "sfx")}_${item.titulo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = url; a.download = `${nome}.${extensao}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.arquivoUrl, "_blank");
    }
  }

  const usosPorSfx = useMemo(() => {
    const mapa: Record<string, SfxUso[]> = {};
    for (const u of usos) (mapa[u.sfxId] ??= []).push(u);
    return mapa;
  }, [usos]);

  const filtrados = itens.filter((s) => {
    if (categoriaAtiva && s.categoria !== categoriaAtiva) return false;
    if (soFavoritos && !s.favorito) return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return s.titulo.toLowerCase().includes(alvo) || s.tags.some((t) => t.includes(alvo));
  });

  const drawerItem = drawerId ? itens.find((s) => s.id === drawerId) ?? null : null;

  return (
    <div>
      <PageHeader
        titulo="SFX"
        descricao="Efeitos sonoros curtos — whoosh, impacto, transição, notificação."
        acao={
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={enviando}
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar"}
          </button>
        }
      />
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = ""; }} />

      <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou tag…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setCategoriaAtiva(null)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!categoriaAtiva ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>Todas</button>
        {CATEGORIAS.map((c) => (
          <button key={c.id} onClick={() => setCategoriaAtiva(c.id === categoriaAtiva ? null : c.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${categoriaAtiva === c.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>{c.rotulo}</button>
        ))}
        <button onClick={() => setSoFavoritos((v) => !v)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono ${soFavoritos ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
          <Star className="h-3 w-3" /> Favoritos
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={Volume2} titulo={itens.length === 0 ? "Nenhum SFX ainda" : "Nenhum SFX encontrado"} descricao={itens.length === 0 ? "Clique em Adicionar pra enviar arquivos de áudio." : "Tente outro termo ou categoria."} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((s) => {
            const usosDoItem = usosPorSfx[s.id] ?? [];
            return (
              <Card key={s.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => setDrawerId(s.id)}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-neutral-100">{s.titulo}</p>
                  {s.favorito && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />}
                </div>
                {s.arquivoUrl && (
                  <audio src={s.arquivoUrl} controls className="mb-2 h-8 w-full" onClick={(e) => e.stopPropagation()} />
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  {s.categoria && <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-teal-300">{CATEGORIAS.find((c) => c.id === s.categoria)?.rotulo}</span>}
                  {s.momento && <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-sky-300">{s.momento}</span>}
                  {s.duracaoSeg != null && <span>{Math.round(s.duracaoSeg * 10) / 10}s</span>}
                  <span className="ml-auto flex items-center gap-0.5"><History className="h-2.5 w-2.5" /> {usosDoItem.length === 0 ? "nunca usado" : `${usosDoItem.length}x`}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {drawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerId(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <button onClick={() => atualizar(drawerItem.id, { favorito: !drawerItem.favorito })} className={drawerItem.favorito ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"}>
                <Star className="h-4 w-4" fill={drawerItem.favorito ? "currentColor" : "none"} />
              </button>
              <button onClick={() => setDrawerId(null)} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {drawerItem.arquivoUrl && <audio src={drawerItem.arquivoUrl} controls className="w-full" />}
              <div className="flex gap-2">
                <button onClick={() => baixar(drawerItem)} className="flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90">
                  <Download className="h-3.5 w-3.5" /> Baixar
                </button>
                {drawerItem.linkOrigem && (
                  <a href={drawerItem.linkOrigem} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200">
                    <ExternalLink className="h-3.5 w-3.5" /> Origem
                  </a>
                )}
              </div>
              <EditableField value={drawerItem.titulo} onSave={(v) => atualizar(drawerItem.id, { titulo: v })} displayClassName="text-lg font-semibold text-neutral-100" />
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Categoria</p>
                <select value={drawerItem.categoria ?? ""} onChange={(e) => atualizar(drawerItem.id, { categoria: (e.target.value || null) as CategoriaSfx | null })} className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none">
                  <option value="">Sem categoria</option>
                  {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Momento de edição</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOMENTOS.map((m) => (
                    <button key={m.id} onClick={() => atualizar(drawerItem.id, { momento: m.id === drawerItem.momento ? null : m.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.momento === m.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{m.rotulo}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Risco de uso</p>
                <div className="flex gap-1.5">
                  {RISCOS.map((r) => (
                    <button key={r.id} onClick={() => atualizar(drawerItem.id, { risco: r.id === drawerItem.risco ? null : r.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.risco === r.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{r.rotulo}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Tags</p>
                <EditableField value={drawerItem.tags.join(", ")} placeholder="tags: comedia, drama..." onSave={(v) => atualizar(drawerItem.id, { tags: v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} displayClassName="text-xs text-teal-500/80" />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-600"><History className="h-3 w-3" /> Registro de uso</p>
                {(usosPorSfx[drawerItem.id] ?? []).length === 0 ? (
                  <p className="text-[11px] text-neutral-600">Nunca usado ainda.</p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {(usosPorSfx[drawerItem.id] ?? []).map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
                        <span className="text-xs text-neutral-300">{u.contexto} — {new Date(u.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                        <button onClick={() => excluirUso(u.id)} className="text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <input value={novoUso} onChange={(e) => setNovoUso(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") registrarUso(drawerItem.id, novoUso); }} placeholder="Ex.: Vlog, Gaming..." className="min-h-[32px] flex-1 rounded-md border border-dashed border-neutral-700 bg-transparent px-2 text-xs text-neutral-300 placeholder-neutral-600 outline-none" />
                  <button onClick={() => registrarUso(drawerItem.id, novoUso)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-teal-400"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
              <button onClick={() => { if (window.confirm("Excluir este SFX?")) excluir(drawerItem.id); }} className="flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
              <button onClick={() => setDrawerId(null)} className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-teal-400">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
