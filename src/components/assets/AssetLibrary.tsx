"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Search, Download, Star, X, History, ExternalLink, Link2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo, resolverUrl, urlAssinada, urlsAssinadas, ehCaminhoInterno } from "@/lib/storage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";

export interface OpcaoCampo { id: string; rotulo: string }
export interface CampoConfig {
  key: string;
  label: string;
  tipo: "select" | "text" | "textarea" | "number" | "tags" | "boolean" | "chips" | "chips-multi";
  opcoes?: OpcaoCampo[];
  placeholder?: string;
}

export interface AssetLibraryConfig {
  tabela: string;
  tabelaUsos?: string;
  usosFk?: string;
  titulo: string;
  descricao: string;
  icone: typeof Star;
  aceitaArquivo?: string;
  arquivoObrigatorio?: boolean;
  tituloPadrao: string;
  camposDrawer: CampoConfig[];
  filtroPrincipal?: string;
  extrairMetadados?: (arquivo: File) => Promise<Record<string, unknown> | null>;
  campoDuracao?: string;
  campoTipoPreview?: "audio" | "imagem" | "video" | "auto";
  // Quando a "biblioteca" e na verdade um subconjunto de uma tabela maior
  // (ex.: Templates vive dentro de "visuais" com tipo='template') — filtra
  // toda leitura por esse campo/valor e ja preenche ele em todo insert, pra
  // nao vazar nem deixar criar item de outro tipo por engano.
  filtroFixo?: { campo: string; valor: string };
}

interface Registro {
  id: string;
  titulo?: string;
  favorito?: boolean;
  arquivo_url?: string | null;
  link_origem?: string | null;
  tags?: string[];
  data?: string;
  contexto?: string;
  [chave: string]: unknown;
}

function ehVideo(url: string): boolean {
  const semQuery = url.split("?")[0].toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v"].some((ext) => semQuery.endsWith(ext));
}
function ehAudio(url: string): boolean {
  const semQuery = url.split("?")[0].toLowerCase();
  return [".mp3", ".wav", ".m4a", ".ogg", ".aac"].some((ext) => semQuery.endsWith(ext));
}

export default function AssetLibrary({ config }: { config: AssetLibraryConfig }) {
  const { user } = useUser();
  const toast = useToast();
  const [itens, setItens] = useState<Registro[]>([]);
  const [usos, setUsos] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<string | null>(null);
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [novoUso, setNovoUso] = useState("");
  const [novoLink, setNovoLink] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    let query = supabase.from(config.tabela).select("*").eq("user_id", user.id).is("excluido_em", null).order("created_at", { ascending: false });
    if (config.filtroFixo) query = query.eq(config.filtroFixo.campo, config.filtroFixo.valor);
    const { data, error } = await query;
    setCarregando(false);
    primeiraCarga.current = false;
    if (error) { toast(`Erro ao carregar: ${error.message}`); return; }
    const carregados = (data as Registro[]) ?? [];
    setItens(carregados);
    if (config.tabelaUsos) {
      const { data: usosData } = await supabase.from(config.tabelaUsos).select("*").eq("user_id", user.id).order("data", { ascending: false });
      setUsos((usosData as Registro[]) ?? []);
    }
    urlsAssinadas(carregados.map((it) => it.arquivo_url)).then(setUrls);
  }, [user, config.tabela, config.tabelaUsos, config.filtroFixo, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionarArquivos(arquivos: FileList) {
    if (!user) return;
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const [url, metadados] = await Promise.all([
          enviarArquivo(config.tabela, user.id, arquivo),
          config.extrairMetadados ? config.extrairMetadados(arquivo) : Promise.resolve(null),
        ]);
        const titulo = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60) || config.tituloPadrao;
        await supabaseBrowser().from(config.tabela).insert({
          user_id: user.id, titulo, arquivo_url: url,
          ...(config.filtroFixo ? { [config.filtroFixo.campo]: config.filtroFixo.valor } : {}),
          ...(metadados ?? {}),
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

  async function adicionarPorLink() {
    if (!user || !novoLink.trim()) return;
    const { error } = await supabaseBrowser().from(config.tabela).insert({
      user_id: user.id, titulo: config.tituloPadrao, link_origem: novoLink.trim(),
      ...(config.filtroFixo ? { [config.filtroFixo.campo]: config.filtroFixo.valor } : {}),
    });
    if (error) { toast("Erro ao adicionar"); return; }
    setNovoLink("");
    toast("Adicionado");
    carregar();
  }

  async function atualizar(id: string, patch: Record<string, unknown>) {
    const { error } = await supabaseBrowser().from(config.tabela).update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabaseBrowser().from(config.tabela).update({ excluido_em: new Date().toISOString() }).eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Movido pra lixeira");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  async function registrarUso(itemId: string, contexto: string) {
    if (!user || !contexto.trim() || !config.tabelaUsos || !config.usosFk) return;
    await supabaseBrowser().from(config.tabelaUsos).insert({ [config.usosFk]: itemId, user_id: user.id, contexto: contexto.trim() });
    setNovoUso("");
    carregar();
  }
  async function excluirUso(id: string) {
    if (!config.tabelaUsos) return;
    await supabaseBrowser().from(config.tabelaUsos).delete().eq("id", id);
    carregar();
  }

  async function baixar(item: Registro) {
    if (!item.arquivo_url) return;
    const urlParaBaixar = resolverUrl(item.arquivo_url, urls) ?? (ehCaminhoInterno(item.arquivo_url) ? await urlAssinada(item.arquivo_url) : null);
    if (!urlParaBaixar) { toast("Erro ao baixar"); return; }
    try {
      const resposta = await fetch(urlParaBaixar);
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const extensao = item.arquivo_url.split("?")[0].split(".").pop() || "bin";
      const nome = String(item.titulo ?? "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = url; a.download = `${nome}.${extensao}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(urlParaBaixar, "_blank");
    }
  }

  const usosPorItem = useMemo(() => {
    const mapa: Record<string, Registro[]> = {};
    if (!config.usosFk) return mapa;
    for (const u of usos) { const chave = String(u[config.usosFk!]); (mapa[chave] ??= []).push(u); }
    return mapa;
  }, [usos, config.usosFk]);

  const opcoesFiltro = config.filtroPrincipal ? config.camposDrawer.find((c) => c.key === config.filtroPrincipal)?.opcoes ?? [] : [];

  const filtrados = itens.filter((it) => {
    if (filtroAtivo && config.filtroPrincipal && it[config.filtroPrincipal] !== filtroAtivo) return false;
    if (soFavoritos && !it.favorito) return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    const tags: string[] = it.tags ?? [];
    return String(it.titulo ?? "").toLowerCase().includes(alvo) || tags.some((t) => t.includes(alvo));
  });

  const drawerItem = drawerId ? itens.find((it) => it.id === drawerId) ?? null : null;

  function renderCampo(campo: CampoConfig, valor: unknown, onSave: (v: unknown) => void) {
    if (campo.tipo === "select") {
      return (
        <select
          value={(valor as string) ?? ""}
          onChange={(e) => onSave(e.target.value || null)}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none"
        >
          <option value="">{`Sem ${campo.label.toLowerCase()}`}</option>
          {campo.opcoes?.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </select>
      );
    }
    if (campo.tipo === "chips") {
      const sel = (valor as string) ?? "";
      return (
        <div className="flex flex-wrap gap-1.5">
          {campo.opcoes?.map((o) => (
            <button
              key={o.id}
              onClick={() => onSave(o.id === sel ? null : o.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${sel === o.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      );
    }
    if (campo.tipo === "chips-multi") {
      const sel = (valor as string[]) ?? [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {campo.opcoes?.map((o) => (
            <button
              key={o.id}
              onClick={() => onSave(sel.includes(o.id) ? sel.filter((s) => s !== o.id) : [...sel, o.id])}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${sel.includes(o.id) ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      );
    }
    if (campo.tipo === "boolean") {
      return (
        <button
          onClick={() => onSave(!valor)}
          className={`rounded-full border px-2.5 py-1 text-[11px] ${valor ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
        >
          {valor ? "Sim" : "Não"}
        </button>
      );
    }
    if (campo.tipo === "number") {
      return (
        <input
          type="number"
          value={(valor as number) ?? ""}
          onChange={(e) => onSave(e.target.value ? Number(e.target.value) : null)}
          placeholder={campo.placeholder}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none"
        />
      );
    }
    if (campo.tipo === "tags") {
      return (
        <EditableField
          value={((valor as string[]) ?? []).join(", ")}
          placeholder={campo.placeholder}
          onSave={(v) => onSave(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))}
          displayClassName="text-xs text-teal-500/80"
        />
      );
    }
    return (
      <EditableField
        as={campo.tipo === "textarea" ? "textarea" : undefined}
        value={(valor as string) ?? ""}
        placeholder={campo.placeholder}
        onSave={(v) => onSave(v || null)}
        displayClassName="text-sm text-neutral-200"
      />
    );
  }

  const Icone = config.icone;

  return (
    <div>
      <PageHeader
        titulo={config.titulo}
        descricao={config.descricao}
        acao={
          config.aceitaArquivo ? (
            <button onClick={() => fileInputRef.current?.click()} disabled={enviando} className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar"}
            </button>
          ) : undefined
        }
      />
      {config.aceitaArquivo && (
        <input ref={fileInputRef} type="file" accept={config.aceitaArquivo} multiple className="hidden" onChange={(e) => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = ""; }} />
      )}

      {!config.aceitaArquivo && (
        <div className="mb-3 flex items-center gap-2">
          <input value={novoLink} onChange={(e) => setNovoLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionarPorLink(); }} placeholder="Cola um link de referência…" className="min-h-[40px] flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
          <button onClick={adicionarPorLink} className="flex min-h-[40px] items-center gap-1.5 rounded-md bg-teal-500 px-3 text-xs font-medium text-neutral-950 hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou tag…" className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none" />
      </div>

      {(opcoesFiltro.length > 0 || true) && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {opcoesFiltro.length > 0 && (
            <>
              <button onClick={() => setFiltroAtivo(null)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!filtroAtivo ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>Todos</button>
              {opcoesFiltro.map((o) => (
                <button key={o.id} onClick={() => setFiltroAtivo(o.id === filtroAtivo ? null : o.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${filtroAtivo === o.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>{o.rotulo}</button>
              ))}
            </>
          )}
          <button onClick={() => setSoFavoritos((v) => !v)} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono ${soFavoritos ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
            <Star className="h-3 w-3" /> Favoritos
          </button>
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState icone={Icone} titulo={itens.length === 0 ? "Nada aqui ainda" : "Nada encontrado"} descricao={itens.length === 0 ? "Adicione o primeiro item." : "Tente outro termo ou filtro."} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((it) => {
            const usosDoItem = config.usosFk ? usosPorItem[it.id] ?? [] : [];
            const url = resolverUrl(it.arquivo_url, urls);
            return (
              <Card key={it.id} className="cursor-pointer p-3 hover:border-teal-500/30" onClick={() => setDrawerId(it.id)}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-neutral-100">{it.titulo}</p>
                  {it.favorito && <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />}
                </div>
                {url && ehAudio(url) && <audio src={url} controls className="mb-2 h-8 w-full" onClick={(e) => e.stopPropagation()} />}
                {url && ehVideo(url) && <video src={url} muted playsInline className="mb-2 h-28 w-full rounded object-cover" />}
                {url && !ehAudio(url) && !ehVideo(url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="mb-2 h-28 w-full rounded object-cover" />
                )}
                {!url && it.link_origem && <p className="mb-2 truncate text-[10px] text-sky-400">{it.link_origem}</p>}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
                  {config.filtroPrincipal && it[config.filtroPrincipal] != null && (
                    <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-teal-300">{opcoesFiltro.find((o) => o.id === it[config.filtroPrincipal!])?.rotulo}</span>
                  )}
                  {config.tabelaUsos && (
                    <span className="ml-auto flex items-center gap-0.5"><History className="h-2.5 w-2.5" /> {usosDoItem.length === 0 ? "nunca usado" : `${usosDoItem.length}x`}</span>
                  )}
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
              {drawerItem.arquivo_url && resolverUrl(drawerItem.arquivo_url, urls) && ehAudio(drawerItem.arquivo_url) && <audio src={resolverUrl(drawerItem.arquivo_url, urls)} controls className="w-full" />}
              {drawerItem.arquivo_url && resolverUrl(drawerItem.arquivo_url, urls) && ehVideo(drawerItem.arquivo_url) && <video src={resolverUrl(drawerItem.arquivo_url, urls)} controls playsInline className="max-h-[240px] w-full rounded object-contain bg-black" />}
              {drawerItem.arquivo_url && resolverUrl(drawerItem.arquivo_url, urls) && !ehAudio(drawerItem.arquivo_url) && !ehVideo(drawerItem.arquivo_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolverUrl(drawerItem.arquivo_url, urls)} alt="" className="max-h-[240px] w-full rounded object-contain bg-black" />
              )}
              <div className="flex flex-wrap gap-2">
                {drawerItem.arquivo_url && (
                  <button onClick={() => baixar(drawerItem)} className="flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90">
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                )}
                {drawerItem.link_origem && (
                  <a href={drawerItem.link_origem} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir link
                  </a>
                )}
              </div>
              <EditableField value={drawerItem.titulo ?? ""} onSave={(v) => atualizar(drawerItem.id, { titulo: v })} displayClassName="text-lg font-semibold text-neutral-100" />

              {config.aceitaArquivo && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-600"><Link2 className="h-3 w-3" /> Link de origem</p>
                  <EditableField value={drawerItem.link_origem ?? ""} placeholder="https://..." onSave={(v) => atualizar(drawerItem.id, { link_origem: v || null })} displayClassName="text-xs text-neutral-400" />
                </div>
              )}

              {config.camposDrawer.map((campo) => (
                <div key={campo.key}>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">{campo.label}</p>
                  {renderCampo(campo, drawerItem[campo.key], (v) => atualizar(drawerItem.id, { [campo.key]: v }))}
                </div>
              ))}

              {config.tabelaUsos && (
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
              )}
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
