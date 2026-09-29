"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Compass, Search, Star, X, ExternalLink, Clock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";

interface Edicao {
  id: string; titulo: string; arquivo_url: string | null; link_origem: string | null;
  plataforma: string | null; criador: string | null; ideia_uso: string | null;
  tags: string[]; favorito: boolean; created_at: string;
}
interface Timestamp { id: string; edicao_id: string; inicio_seg: number; fim_seg: number | null; nota: string; }

function formatarTempo(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function parseTempo(texto: string): number | null {
  const partes = texto.trim().split(":");
  if (partes.length === 1) return Number(partes[0]) || null;
  if (partes.length === 2) return (Number(partes[0]) || 0) * 60 + (Number(partes[1]) || 0);
  return null;
}

export default function EdicoesPage() {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<Edicao[]>([]);
  const [timestamps, setTimestamps] = useState<Timestamp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [novoInicio, setNovoInicio] = useState("");
  const [novoFim, setNovoFim] = useState("");
  const [novaNota, setNovaNota] = useState("");
  const [novoLink, setNovoLink] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    const [{ data }, { data: tsData }] = await Promise.all([
      supabase.from("edicoes_referencia").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("edicoes_timestamps").select("*").eq("user_id", user.id).order("inicio_seg"),
    ]);
    setItens((data as Edicao[]) ?? []);
    setTimestamps((tsData as Timestamp[]) ?? []);
    setCarregando(false);
    primeiraCarga.current = false;
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!user || !novoLink.trim()) return;
    const { error } = await supabaseBrowser().from("edicoes_referencia").insert({ user_id: user.id, titulo: "Nova edição de referência", link_origem: novoLink.trim() });
    if (error) { toast("Erro ao adicionar"); return; }
    setNovoLink("");
    carregar();
  }

  async function atualizar(id: string, patch: Record<string, unknown>) {
    const { error } = await supabaseBrowser().from("edicoes_referencia").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabaseBrowser().from("edicoes_referencia").delete().eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Removido");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  async function adicionarTimestamp(edicaoId: string) {
    if (!user) return;
    const inicio = parseTempo(novoInicio);
    if (inicio == null) { toast("Digite o início (ex.: 0:07)"); return; }
    const fim = novoFim.trim() ? parseTempo(novoFim) : null;
    const { error } = await supabaseBrowser().from("edicoes_timestamps").insert({
      edicao_id: edicaoId, user_id: user.id, inicio_seg: inicio, fim_seg: fim, nota: novaNota.trim(),
    });
    if (error) { toast("Erro ao marcar timestamp"); return; }
    setNovoInicio(""); setNovoFim(""); setNovaNota("");
    carregar();
  }
  async function excluirTimestamp(id: string) {
    await supabaseBrowser().from("edicoes_timestamps").delete().eq("id", id);
    carregar();
  }
  function marcarInicioAgora() {
    if (videoRef.current) setNovoInicio(formatarTempo(videoRef.current.currentTime));
  }
  function marcarFimAgora() {
    if (videoRef.current) setNovoFim(formatarTempo(videoRef.current.currentTime));
  }
  function irPara(seg: number) {
    if (videoRef.current) { videoRef.current.currentTime = seg; videoRef.current.play(); }
  }

  const timestampsPorEdicao = useMemo(() => {
    const mapa: Record<string, Timestamp[]> = {};
    for (const t of timestamps) (mapa[t.edicao_id] ??= []).push(t);
    return mapa;
  }, [timestamps]);

  const filtrados = itens.filter((e) => {
    if (soFavoritos && !e.favorito) return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return e.titulo.toLowerCase().includes(alvo) || (e.ideia_uso ?? "").toLowerCase().includes(alvo) || e.tags.some((t) => t.includes(alvo));
  });

  const drawerItem = drawerId ? itens.find((e) => e.id === drawerId) ?? null : null;
  const ehVideoLocal = drawerItem?.arquivo_url && [".mp4", ".webm", ".mov", ".m4v"].some((ext) => drawerItem.arquivo_url!.toLowerCase().endsWith(ext));

  return (
    <div>
      <PageHeader titulo="Edições" descricao="Vídeos de referência — o que quero pegar daqui, com os trechos marcados." />

      <div className="mb-3 flex items-center gap-2">
        <input value={novoLink} onChange={(e) => setNovoLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} placeholder="Cola o link do vídeo de referência…" className="min-h-[40px] flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
        <button onClick={adicionar} className="flex min-h-[40px] items-center gap-1.5 rounded-md bg-teal-500 px-3 text-xs font-medium text-neutral-950 hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, ideia de uso ou tag…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
        <button onClick={() => setSoFavoritos((v) => !v)} className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${soFavoritos ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-500"}`}>
          <Star className="h-3 w-3" /> Favoritos
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={Compass} titulo={itens.length === 0 ? "Nenhuma edição salva ainda" : "Nada encontrado"} descricao={itens.length === 0 ? "Cola o link de um vídeo de referência acima." : "Tente outro termo."} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((e) => {
            const tsDoItem = timestampsPorEdicao[e.id] ?? [];
            return (
              <Card key={e.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => setDrawerId(e.id)}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-neutral-100">{e.titulo}</p>
                  {e.favorito && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />}
                </div>
                {e.link_origem && <p className="mb-1.5 truncate text-[10px] text-sky-400">{e.link_origem}</p>}
                {e.ideia_uso && <p className="mb-1.5 line-clamp-2 text-xs text-neutral-400">{e.ideia_uso}</p>}
                {tsDoItem.length > 0 && (
                  <p className="flex items-center gap-1 text-[10px] text-neutral-500"><Clock className="h-2.5 w-2.5" /> {tsDoItem.length} trecho{tsDoItem.length === 1 ? "" : "s"} marcado{tsDoItem.length === 1 ? "" : "s"}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {drawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerId(null)} />
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <button onClick={() => atualizar(drawerItem.id, { favorito: !drawerItem.favorito })} className={drawerItem.favorito ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"}>
                <Star className="h-4 w-4" fill={drawerItem.favorito ? "currentColor" : "none"} />
              </button>
              <button onClick={() => setDrawerId(null)} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {ehVideoLocal && <video ref={videoRef} src={drawerItem.arquivo_url!} controls playsInline className="max-h-[240px] w-full rounded bg-black object-contain" />}
              {drawerItem.link_origem && (
                <a href={drawerItem.link_origem} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300">
                  <ExternalLink className="h-3.5 w-3.5" /> {drawerItem.link_origem}
                </a>
              )}
              <EditableField value={drawerItem.titulo} onSave={(v) => atualizar(drawerItem.id, { titulo: v })} displayClassName="text-lg font-semibold text-neutral-100" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Plataforma</p>
                  <EditableField value={drawerItem.plataforma ?? ""} placeholder="TikTok, YouTube..." onSave={(v) => atualizar(drawerItem.id, { plataforma: v || null })} displayClassName="text-sm text-neutral-200" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Criador</p>
                  <EditableField value={drawerItem.criador ?? ""} placeholder="@quem postou" onSave={(v) => atualizar(drawerItem.id, { criador: v || null })} displayClassName="text-sm text-neutral-200" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">O que quero pegar daqui</p>
                <EditableField as="textarea" value={drawerItem.ideia_uso ?? ""} placeholder='Ex.: "ritmo da intro", "estilo da legenda", "color"...' onSave={(v) => atualizar(drawerItem.id, { ideia_uso: v || null })} displayClassName="text-sm text-neutral-200" />
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Tags</p>
                <EditableField value={drawerItem.tags.join(", ")} placeholder="tags: ritmo, color, transicao..." onSave={(v) => atualizar(drawerItem.id, { tags: v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} displayClassName="text-xs text-teal-500/80" />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-600"><Clock className="h-3 w-3" /> Trechos marcados</p>
                {(timestampsPorEdicao[drawerItem.id] ?? []).length === 0 ? (
                  <p className="mb-2 text-[11px] text-neutral-600">Nenhum trecho marcado ainda.</p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {(timestampsPorEdicao[drawerItem.id] ?? []).map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
                        <button onClick={() => ehVideoLocal && irPara(t.inicio_seg)} className={`font-mono text-xs ${ehVideoLocal ? "text-teal-300 hover:underline" : "text-neutral-300"}`}>
                          {formatarTempo(t.inicio_seg)}{t.fim_seg != null && `–${formatarTempo(t.fim_seg)}`}
                        </button>
                        <span className="flex-1 truncate text-xs text-neutral-400">{t.nota}</span>
                        <button onClick={() => excluirTimestamp(t.id)} className="text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5 rounded-md border border-dashed border-neutral-700 p-2">
                  <div className="flex items-center gap-1.5">
                    <input value={novoInicio} onChange={(e) => setNovoInicio(e.target.value)} placeholder="início (0:07)" className="w-24 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none" />
                    {ehVideoLocal && <button onClick={marcarInicioAgora} className="text-[10px] text-neutral-500 hover:text-teal-300">marcar</button>}
                    <input value={novoFim} onChange={(e) => setNovoFim(e.target.value)} placeholder="fim (opcional)" className="w-28 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none" />
                    {ehVideoLocal && <button onClick={marcarFimAgora} className="text-[10px] text-neutral-500 hover:text-teal-300">marcar</button>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input value={novaNota} onChange={(e) => setNovaNota(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionarTimestamp(drawerItem.id); }} placeholder="Ex.: animação da legenda" className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 outline-none" />
                    <button onClick={() => adicionarTimestamp(drawerItem.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-teal-400"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
              <button onClick={() => { if (window.confirm("Excluir esta edição de referência?")) excluir(drawerItem.id); }} className="flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
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
