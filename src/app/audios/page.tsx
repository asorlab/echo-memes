"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Music, Search, Download, Star, X, History, ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo, resolverUrl, urlAssinada, urlsAssinadas, ehCaminhoInterno } from "@/lib/storage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import { extrairDuracaoAudio } from "@/lib/metadados";
import type { Audio, AudioUso, CategoriaSfx, Clima, Licenciamento, Momento, Risco, TipoAudio } from "@/lib/types";

interface AudioRow {
  id: string; titulo: string; arquivo_url: string | null; tipo: TipoAudio | null; categoria_sfx: CategoriaSfx | null;
  artista: string | null; licenciamento: Licenciamento | null; clima: Clima | null; bpm: number | null;
  momento: Momento | null; risco: Risco | null; duracao_seg: number | null; tags: string[];
  link_origem: string | null; favorito: boolean; created_at: string;
}
interface AudioUsoRow { id: string; audio_id: string; contexto: string; data: string; }

function mapAudio(r: AudioRow): Audio {
  return {
    id: r.id, titulo: r.titulo, arquivoUrl: r.arquivo_url, tipo: r.tipo, categoriaSfx: r.categoria_sfx,
    artista: r.artista, licenciamento: r.licenciamento, clima: r.clima, bpm: r.bpm, momento: r.momento,
    risco: r.risco, duracaoSeg: r.duracao_seg, tags: r.tags ?? [], linkOrigem: r.link_origem,
    favorito: r.favorito, criadoEm: r.created_at,
  };
}
function mapUso(r: AudioUsoRow): AudioUso {
  return { id: r.id, audioId: r.audio_id, contexto: r.contexto, data: r.data };
}

const TIPOS: { id: TipoAudio; rotulo: string }[] = [
  { id: "sfx", rotulo: "SFX" }, { id: "musica", rotulo: "Música" }, { id: "fala", rotulo: "Fala" },
  { id: "trend", rotulo: "Trend" }, { id: "ambiente", rotulo: "Ambiente" },
];
const CATEGORIAS_SFX: { id: CategoriaSfx; rotulo: string }[] = [
  { id: "whoosh", rotulo: "Whoosh" }, { id: "impacto", rotulo: "Impacto" }, { id: "notificacao", rotulo: "Notificação" },
  { id: "transicao", rotulo: "Transição" }, { id: "risada", rotulo: "Risada" }, { id: "erro", rotulo: "Erro" },
  { id: "sucesso", rotulo: "Sucesso" }, { id: "ambiente", rotulo: "Ambiente" }, { id: "outro", rotulo: "Outro" },
];
const CLIMAS: { id: Clima; rotulo: string }[] = [
  { id: "upbeat", rotulo: "Upbeat" }, { id: "calmo", rotulo: "Calmo" }, { id: "tenso", rotulo: "Tenso" },
  { id: "emotivo", rotulo: "Emotivo" }, { id: "epico", rotulo: "Épico" }, { id: "engracado", rotulo: "Engraçado" },
  { id: "misterioso", rotulo: "Misterioso" }, { id: "romantico", rotulo: "Romântico" },
];
const MOMENTOS: { id: Momento; rotulo: string }[] = [
  { id: "gancho", rotulo: "Gancho" }, { id: "transicao", rotulo: "Transição" }, { id: "punchline", rotulo: "Punchline" }, { id: "fecho", rotulo: "Fecho" },
];
const RISCOS: { id: Risco; rotulo: string }[] = [
  { id: "baixo", rotulo: "Baixo" }, { id: "medio", rotulo: "Médio" }, { id: "alto", rotulo: "Alto" },
];
const LICENCIAMENTOS: { id: Licenciamento; rotulo: string; icone: typeof ShieldCheck }[] = [
  { id: "licenciado", rotulo: "Licenciado", icone: ShieldCheck },
  { id: "nao_licenciado", rotulo: "Não licenciado", icone: ShieldAlert },
  { id: "desconhecido", rotulo: "Desconhecido", icone: ShieldQuestion },
];

export default function AudiosPage() {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<Audio[]>([]);
  const [usos, setUsos] = useState<AudioUso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipoAtivo, setTipoAtivo] = useState<TipoAudio | null>(null);
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [soLicenciados, setSoLicenciados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [novoUso, setNovoUso] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    const [{ data }, { data: usosData }] = await Promise.all([
      supabase.from("audios").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("audios_usos").select("*").eq("user_id", user.id).order("data", { ascending: false }),
    ]);
    const carregados = ((data as AudioRow[]) ?? []).map(mapAudio);
    setItens(carregados);
    setUsos(((usosData as AudioUsoRow[]) ?? []).map(mapUso));
    setCarregando(false);
    primeiraCarga.current = false;
    urlsAssinadas(carregados.map((a) => a.arquivoUrl)).then(setUrls);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarArquivos(arquivos: FileList) {
    if (!user) return;
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const [url, metadados] = await Promise.all([
          enviarArquivo("audios", user.id, arquivo),
          extrairDuracaoAudio(arquivo),
        ]);
        const titulo = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Novo áudio";
        await supabaseBrowser().from("audios").insert({
          user_id: user.id, titulo, arquivo_url: url, tipo: tipoAtivo ?? "musica",
          ...(metadados ?? {}),
        });
      }
      toast(arquivos.length > 1 ? `${arquivos.length} áudios adicionados` : "Áudio adicionado");
      carregar();
    } catch {
      toast("Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  async function atualizar(id: string, patch: Partial<{
    titulo: string; tipo: TipoAudio | null; categoria_sfx: CategoriaSfx | null; artista: string | null;
    licenciamento: Licenciamento | null; clima: Clima | null; bpm: number | null; momento: Momento | null;
    risco: Risco | null; tags: string[]; favorito: boolean;
  }>) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("audios").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("audios").delete().eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Áudio removido");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  async function registrarUso(audioId: string, contexto: string) {
    if (!user || !contexto.trim()) return;
    await supabaseBrowser().from("audios_usos").insert({ audio_id: audioId, user_id: user.id, contexto: contexto.trim() });
    setNovoUso("");
    carregar();
  }
  async function excluirUso(id: string) {
    await supabaseBrowser().from("audios_usos").delete().eq("id", id);
    carregar();
  }

  async function baixar(item: Audio) {
    if (!item.arquivoUrl) return;
    const urlParaBaixar = resolverUrl(item.arquivoUrl, urls) ?? (ehCaminhoInterno(item.arquivoUrl) ? await urlAssinada(item.arquivoUrl) : null);
    if (!urlParaBaixar) { toast("Erro ao baixar"); return; }
    try {
      const resposta = await fetch(urlParaBaixar);
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const extensao = item.arquivoUrl.split("?")[0].split(".").pop() || "mp3";
      const nome = `${(item.tipo ?? "audio")}_${item.titulo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = url; a.download = `${nome}.${extensao}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(urlParaBaixar, "_blank");
    }
  }

  const usosPorAudio = useMemo(() => {
    const mapa: Record<string, AudioUso[]> = {};
    for (const u of usos) (mapa[u.audioId] ??= []).push(u);
    return mapa;
  }, [usos]);

  const filtrados = itens.filter((a) => {
    if (tipoAtivo && a.tipo !== tipoAtivo) return false;
    if (soFavoritos && !a.favorito) return false;
    if (soLicenciados && a.licenciamento !== "licenciado") return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return a.titulo.toLowerCase().includes(alvo) || (a.artista ?? "").toLowerCase().includes(alvo) || a.tags.some((t) => t.includes(alvo));
  });

  const drawerItem = drawerId ? itens.find((a) => a.id === drawerId) ?? null : null;

  return (
    <div>
      <PageHeader
        titulo="Áudios"
        descricao="SFX, músicas, falas, trends e ambientes — tudo que toca."
        acao={
          <button onClick={() => fileInputRef.current?.click()} disabled={enviando} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar"}
          </button>
        }
      />
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = ""; }} />

      <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, artista ou tag…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setTipoAtivo(null)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!tipoAtivo ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>Todos</button>
        {TIPOS.map((t) => (
          <button key={t.id} onClick={() => setTipoAtivo(t.id === tipoAtivo ? null : t.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${tipoAtivo === t.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>{t.rotulo}</button>
        ))}
      </div>
      <p className="mb-2 text-[10px] text-neutral-600">Novos arquivos entram como &quot;{TIPOS.find((t) => t.id === tipoAtivo)?.rotulo ?? "Música"}&quot; — escolhe o tipo no filtro acima antes de enviar.</p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setSoFavoritos((v) => !v)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono ${soFavoritos ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
          <Star className="h-3 w-3" /> Favoritos
        </button>
        <button onClick={() => setSoLicenciados((v) => !v)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono ${soLicenciados ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
          <ShieldCheck className="h-3 w-3" /> Só licenciados
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={Music} titulo={itens.length === 0 ? "Nenhum áudio ainda" : "Nenhum áudio encontrado"} descricao={itens.length === 0 ? "Clique em Adicionar pra enviar arquivos." : "Tente outro termo ou filtro."} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a) => {
            const usosDoItem = usosPorAudio[a.id] ?? [];
            return (
              <Card key={a.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => setDrawerId(a.id)}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">{a.titulo}</p>
                    {a.artista && <p className="truncate text-[10px] text-neutral-500">{a.artista}</p>}
                  </div>
                  {a.favorito && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />}
                </div>
                {a.arquivoUrl && resolverUrl(a.arquivoUrl, urls) && <audio src={resolverUrl(a.arquivoUrl, urls)} controls className="mb-2 h-8 w-full" onClick={(e) => e.stopPropagation()} />}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  {a.tipo && <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-teal-300">{TIPOS.find((t) => t.id === a.tipo)?.rotulo}</span>}
                  {a.categoriaSfx && <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-neutral-400">{CATEGORIAS_SFX.find((c) => c.id === a.categoriaSfx)?.rotulo}</span>}
                  {a.clima && <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-neutral-400">{CLIMAS.find((c) => c.id === a.clima)?.rotulo}</span>}
                  {a.bpm != null && <span>{a.bpm} BPM</span>}
                  {a.duracaoSeg != null && <span>{Math.round(a.duracaoSeg)}s</span>}
                  {a.licenciamento === "licenciado" && <ShieldCheck className="h-3 w-3 text-teal-400" />}
                  {a.licenciamento === "nao_licenciado" && <ShieldAlert className="h-3 w-3 text-[#F0997B]" />}
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
              {drawerItem.arquivoUrl && resolverUrl(drawerItem.arquivoUrl, urls) && <audio src={resolverUrl(drawerItem.arquivoUrl, urls)} controls className="w-full" />}
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
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Tipo</p>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS.map((t) => (
                    <button key={t.id} onClick={() => atualizar(drawerItem.id, { tipo: t.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.tipo === t.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{t.rotulo}</button>
                  ))}
                </div>
              </div>

              {drawerItem.tipo === "sfx" && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Categoria do SFX</p>
                  <select value={drawerItem.categoriaSfx ?? ""} onChange={(e) => atualizar(drawerItem.id, { categoria_sfx: (e.target.value || null) as CategoriaSfx | null })} className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none">
                    <option value="">Sem categoria</option>
                    {CATEGORIAS_SFX.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                </div>
              )}

              {drawerItem.tipo !== "sfx" && (
                <>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Artista / fonte</p>
                    <EditableField value={drawerItem.artista ?? ""} placeholder="Quem fez esse áudio" onSave={(v) => atualizar(drawerItem.id, { artista: v || null })} displayClassName="text-sm text-neutral-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Clima</p>
                      <select value={drawerItem.clima ?? ""} onChange={(e) => atualizar(drawerItem.id, { clima: (e.target.value || null) as Clima | null })} className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none">
                        <option value="">Sem clima definido</option>
                        {CLIMAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">BPM</p>
                      <input type="number" value={drawerItem.bpm ?? ""} onChange={(e) => atualizar(drawerItem.id, { bpm: e.target.value ? Number(e.target.value) : null })} placeholder="ex.: 120" className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none" />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Licenciamento</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LICENCIAMENTOS.map((l) => {
                        const Icone = l.icone;
                        return (
                          <button key={l.id} onClick={() => atualizar(drawerItem.id, { licenciamento: l.id === drawerItem.licenciamento ? null : l.id })} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.licenciamento === l.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>
                            <Icone className="h-3 w-3" /> {l.rotulo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

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
                <EditableField value={drawerItem.tags.join(", ")} placeholder="tags: pop, drum-and-bass..." onSave={(v) => atualizar(drawerItem.id, { tags: v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} displayClassName="text-xs text-teal-500/80" />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-600"><History className="h-3 w-3" /> Registro de uso</p>
                {(usosPorAudio[drawerItem.id] ?? []).length === 0 ? (
                  <p className="text-[11px] text-neutral-600">Nunca usado ainda.</p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {(usosPorAudio[drawerItem.id] ?? []).map((u) => (
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
              <button onClick={() => { if (window.confirm("Excluir este áudio?")) excluir(drawerItem.id); }} className="flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
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
