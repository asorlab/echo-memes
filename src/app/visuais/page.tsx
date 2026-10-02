"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Trash2, Image as ImageIcon, Search, Download, Star, X, History, ExternalLink } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo, resolverUrl, urlAssinada, urlsAssinadas, ehCaminhoInterno } from "@/lib/storage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import { extrairMetadadosArquivo } from "@/lib/metadados";

type TipoVisual = "overlay" | "transicao" | "textura" | "png_elemento" | "preset_lut" | "b_roll" | "green_screen" | "gif" | "template";
type AppCompativel = "capcut" | "premiere" | "davinci" | "lut_generico" | "outro";
type EstiloVisual = "cinematic" | "vibrante" | "preto_e_branco" | "vintage" | "cru" | "outro";
type Momento = "gancho" | "transicao" | "punchline" | "fecho";

interface Visual {
  id: string; titulo: string; arquivoUrl: string | null; linkOrigem: string | null; tipo: TipoVisual | null;
  transparente: boolean | null; appCompativel: AppCompativel | null; estilo: EstiloVisual | null;
  momento: Momento | null; duracaoSeg: number | null; tags: string[]; favorito: boolean; criadoEm: string;
}
interface VisualRow {
  id: string; titulo: string; arquivo_url: string | null; link_origem: string | null; tipo: TipoVisual | null;
  transparente: boolean | null; app_compativel: AppCompativel | null; estilo: EstiloVisual | null;
  momento: Momento | null; duracao_seg: number | null; tags: string[]; favorito: boolean; created_at: string;
}
interface VisualUso { id: string; visualId: string; contexto: string; data: string; }
interface VisualUsoRow { id: string; visual_id: string; contexto: string; data: string; }

function mapVisual(r: VisualRow): Visual {
  return {
    id: r.id, titulo: r.titulo, arquivoUrl: r.arquivo_url, linkOrigem: r.link_origem, tipo: r.tipo,
    transparente: r.transparente, appCompativel: r.app_compativel, estilo: r.estilo, momento: r.momento,
    duracaoSeg: r.duracao_seg, tags: r.tags ?? [], favorito: r.favorito, criadoEm: r.created_at,
  };
}
function mapUso(r: VisualUsoRow): VisualUso {
  return { id: r.id, visualId: r.visual_id, contexto: r.contexto, data: r.data };
}

function ehVideo(url: string): boolean {
  const semQuery = url.split("?")[0].toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v"].some((ext) => semQuery.endsWith(ext));
}

const TIPOS: { id: TipoVisual; rotulo: string }[] = [
  { id: "overlay", rotulo: "Overlay" }, { id: "transicao", rotulo: "Transição" }, { id: "textura", rotulo: "Textura" },
  { id: "png_elemento", rotulo: "PNG/Elemento" }, { id: "preset_lut", rotulo: "Preset/LUT" },
  { id: "b_roll", rotulo: "B-roll" }, { id: "green_screen", rotulo: "Green screen" }, { id: "gif", rotulo: "GIF" }, { id: "template", rotulo: "Template" },
];
const TIPOS_VALIDOS = new Set<string>(TIPOS.map((t) => t.id));
const APPS: { id: AppCompativel; rotulo: string }[] = [
  { id: "capcut", rotulo: "CapCut" }, { id: "premiere", rotulo: "Premiere" }, { id: "davinci", rotulo: "DaVinci" },
  { id: "lut_generico", rotulo: "LUT genérico" }, { id: "outro", rotulo: "Outro" },
];
const ESTILOS: { id: EstiloVisual; rotulo: string }[] = [
  { id: "cinematic", rotulo: "Cinematic" }, { id: "vibrante", rotulo: "Vibrante" }, { id: "preto_e_branco", rotulo: "P&B" },
  { id: "vintage", rotulo: "Vintage" }, { id: "cru", rotulo: "Cru" }, { id: "outro", rotulo: "Outro" },
];
const MOMENTOS: { id: Momento; rotulo: string }[] = [
  { id: "gancho", rotulo: "Gancho" }, { id: "transicao", rotulo: "Transição" }, { id: "punchline", rotulo: "Punchline" }, { id: "fecho", rotulo: "Fecho" },
];

export default function VisuaisPage() {
  const { user } = useUser();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [itens, setItens] = useState<Visual[]>([]);
  const [usos, setUsos] = useState<VisualUso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // Filtro de tipo: URL (?tipo=) primeiro — isso e o que permite
  // /visuais?tipo=template funcionar como link direto pro que antes era a
  // pagina /templates separada (agora so um filtro aqui, mesma tabela).
  const [tipoAtivo, setTipoAtivoInterno] = useState<TipoVisual | null>(() => {
    const doUrl = searchParams.get("tipo");
    return doUrl && TIPOS_VALIDOS.has(doUrl) ? (doUrl as TipoVisual) : null;
  });
  const setTipoAtivo = useCallback((tipo: TipoVisual | null) => {
    setTipoAtivoInterno(tipo);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (tipo) params.set("tipo", tipo); else params.delete("tipo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);
  const [soFavoritos, setSoFavoritos] = useState(false);
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
    const [{ data, error }, { data: usosData }] = await Promise.all([
      supabase.from("visuais").select("*").eq("user_id", user.id).is("excluido_em", null).order("created_at", { ascending: false }),
      supabase.from("visuais_usos").select("*").eq("user_id", user.id).order("data", { ascending: false }),
    ]);
    setCarregando(false);
    primeiraCarga.current = false;
    if (error) { toast(`Erro ao carregar visuais: ${error.message}`); return; }
    const carregados = ((data as VisualRow[]) ?? []).map(mapVisual);
    setItens(carregados);
    setUsos(((usosData as VisualUsoRow[]) ?? []).map(mapUso));
    urlsAssinadas(carregados.map((v) => v.arquivoUrl)).then(setUrls);
  }, [user, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarArquivos(arquivos: FileList) {
    if (!user) return;
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const [url, metadados] = await Promise.all([
          enviarArquivo("visuais", user.id, arquivo),
          extrairMetadadosArquivo(arquivo),
        ]);
        const titulo = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Novo visual";
        await supabaseBrowser().from("visuais").insert({
          user_id: user.id, titulo, arquivo_url: url, tipo: tipoAtivo ?? "overlay", ...(metadados ?? {}),
        });
      }
      toast(arquivos.length > 1 ? `${arquivos.length} adicionados` : "Adicionado");
      carregar();
    } catch {
      toast("Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  async function atualizar(id: string, patch: Partial<{
    titulo: string; tipo: TipoVisual | null; transparente: boolean | null; app_compativel: AppCompativel | null;
    estilo: EstiloVisual | null; momento: Momento | null; tags: string[]; favorito: boolean; link_origem: string | null;
  }>) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("visuais").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("visuais").update({ excluido_em: new Date().toISOString() }).eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Movido pra lixeira");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  async function registrarUso(visualId: string, contexto: string) {
    if (!user || !contexto.trim()) return;
    await supabaseBrowser().from("visuais_usos").insert({ visual_id: visualId, user_id: user.id, contexto: contexto.trim() });
    setNovoUso("");
    carregar();
  }
  async function excluirUso(id: string) {
    await supabaseBrowser().from("visuais_usos").delete().eq("id", id);
    carregar();
  }

  async function baixar(item: Visual) {
    if (!item.arquivoUrl) return;
    const urlParaBaixar = resolverUrl(item.arquivoUrl, urls) ?? (ehCaminhoInterno(item.arquivoUrl) ? await urlAssinada(item.arquivoUrl) : null);
    if (!urlParaBaixar) { toast("Erro ao baixar"); return; }
    try {
      const resposta = await fetch(urlParaBaixar);
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const extensao = item.arquivoUrl.split("?")[0].split(".").pop() || "png";
      const nome = `${(item.tipo ?? "visual")}_${item.titulo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = url; a.download = `${nome}.${extensao}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(urlParaBaixar, "_blank");
    }
  }

  const usosPorItem = useMemo(() => {
    const mapa: Record<string, VisualUso[]> = {};
    for (const u of usos) (mapa[u.visualId] ??= []).push(u);
    return mapa;
  }, [usos]);

  const filtrados = itens.filter((v) => {
    if (tipoAtivo && v.tipo !== tipoAtivo) return false;
    if (soFavoritos && !v.favorito) return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return v.titulo.toLowerCase().includes(alvo) || v.tags.some((t) => t.includes(alvo));
  });

  const drawerItem = drawerId ? itens.find((v) => v.id === drawerId) ?? null : null;

  return (
    <div>
      <PageHeader
        titulo="Visuais"
        descricao="Overlays, transições, texturas, elementos e presets/LUT."
        acao={
          <button onClick={() => fileInputRef.current?.click()} disabled={enviando} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar"}
          </button>
        }
      />
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = ""; }} />

      <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou tag…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setTipoAtivo(null)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!tipoAtivo ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>Todos</button>
        {TIPOS.map((t) => (
          <button key={t.id} onClick={() => setTipoAtivo(t.id === tipoAtivo ? null : t.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${tipoAtivo === t.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>{t.rotulo}</button>
        ))}
      </div>
      <p className="mb-2 text-[10px] text-neutral-600">Novos arquivos entram como &quot;{TIPOS.find((t) => t.id === tipoAtivo)?.rotulo ?? "Overlay"}&quot;. Escolha o tipo no filtro acima antes de enviar.</p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setSoFavoritos((v) => !v)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono ${soFavoritos ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
          <Star className="h-3 w-3" /> Favoritos
        </button>
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={ImageIcon} titulo={itens.length === 0 ? "Nada aqui ainda" : "Nada encontrado"} descricao={itens.length === 0 ? "Clique em Adicionar pra enviar arquivos." : "Tente outro termo ou filtro."} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((v) => {
            const usosDoItem = usosPorItem[v.id] ?? [];
            return (
              <Card key={v.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => setDrawerId(v.id)}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-neutral-100">{v.titulo}</p>
                  {v.favorito && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />}
                </div>
                {v.arquivoUrl && resolverUrl(v.arquivoUrl, urls) && (
                  ehVideo(v.arquivoUrl) ? (
                    <video src={resolverUrl(v.arquivoUrl, urls)} muted playsInline className="mb-2 h-28 w-full rounded object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolverUrl(v.arquivoUrl, urls)} alt="" className="mb-2 h-28 w-full rounded object-cover" />
                  )
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  {v.tipo && <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-teal-300">{TIPOS.find((t) => t.id === v.tipo)?.rotulo}</span>}
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
              {drawerItem.arquivoUrl && resolverUrl(drawerItem.arquivoUrl, urls) && (
                ehVideo(drawerItem.arquivoUrl) ? (
                  <video src={resolverUrl(drawerItem.arquivoUrl, urls)} controls playsInline className="max-h-[240px] w-full rounded bg-black object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolverUrl(drawerItem.arquivoUrl, urls)} alt="" className="max-h-[240px] w-full rounded bg-black object-contain" />
                )
              )}
              <div className="flex flex-wrap gap-2">
                {drawerItem.arquivoUrl && (
                  <button onClick={() => baixar(drawerItem)} className="flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90">
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                )}
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

              {drawerItem.tipo === "overlay" && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Transparência</p>
                  <button onClick={() => atualizar(drawerItem.id, { transparente: !drawerItem.transparente })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.transparente ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>
                    {drawerItem.transparente ? "Tem alpha" : "Sem alpha"}
                  </button>
                </div>
              )}

              {drawerItem.tipo === "preset_lut" && (
                <>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">App compatível</p>
                    <select value={drawerItem.appCompativel ?? ""} onChange={(e) => atualizar(drawerItem.id, { app_compativel: (e.target.value || null) as AppCompativel | null })} className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none">
                      <option value="">Sem app definido</option>
                      {APPS.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Estilo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ESTILOS.map((e) => (
                        <button key={e.id} onClick={() => atualizar(drawerItem.id, { estilo: e.id === drawerItem.estilo ? null : e.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.estilo === e.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{e.rotulo}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(drawerItem.tipo === "overlay" || drawerItem.tipo === "transicao") && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Momento de edição</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MOMENTOS.map((m) => (
                      <button key={m.id} onClick={() => atualizar(drawerItem.id, { momento: m.id === drawerItem.momento ? null : m.id })} className={`rounded-full border px-2.5 py-1 text-[11px] ${drawerItem.momento === m.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{m.rotulo}</button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Tags</p>
                <EditableField value={drawerItem.tags.join(", ")} placeholder="tags: escuro, urbano..." onSave={(v) => atualizar(drawerItem.id, { tags: v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} displayClassName="text-xs text-teal-500/80" />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-600"><History className="h-3 w-3" /> Registro de uso</p>
                {(usosPorItem[drawerItem.id] ?? []).length === 0 ? (
                  <p className="text-[11px] text-neutral-600">Nunca usado ainda.</p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {(usosPorItem[drawerItem.id] ?? []).map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
                        <span className="text-xs text-neutral-300">{u.contexto} · {new Date(u.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
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
              <button onClick={() => { if (window.confirm("Excluir este item?")) excluir(drawerItem.id); }} className="flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
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
