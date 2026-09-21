"use client";
import ImportarPerfil from "@/components/memes/ImportarPerfil";
import ImportActivity from "@/components/memes/ImportActivity";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, Image as ImageIcon, ExternalLink, Sparkles, Search, Download, Loader2, Link2, PencilLine, ChevronDown, Rss, CheckSquare, Square } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo } from "@/lib/storage";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import type { Categoria, Meme } from "@/lib/types";

interface MemeRow {
  id: string; user_id: string; titulo: string; imagem_url: string | null;
  link_origem: string | null; explicacao: string; tags: string[]; created_at: string;
  plataforma: string | null; criador: string | null; categoria: Categoria | null; publicado_em: string | null;
}

const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: "iveasor", rotulo: "IveAsor" },
  { id: "asor", rotulo: "ASOR.lab" },
  { id: "aivil", rotulo: "AIVIL" },
  { id: "geral", rotulo: "Geral" },
];

const EXTENSOES_VIDEO = [".mp4", ".webm", ".mov", ".m4v"];
function ehVideo(url: string): boolean {
  const semQuery = url.split("?")[0].toLowerCase();
  return EXTENSOES_VIDEO.some((ext) => semQuery.endsWith(ext));
}

function mapMeme(r: MemeRow): Meme {
  return {
    id: r.id, titulo: r.titulo, imagemUrl: r.imagem_url, linkOrigem: r.link_origem, explicacao: r.explicacao,
    tags: r.tags ?? [], criadoEm: r.created_at, plataforma: r.plataforma, criador: r.criador,
    categoria: r.categoria, publicadoEm: r.publicado_em,
  };
}

function paraListaDeTags(valor: string): string[] {
  return valor.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
}
function paraTextoDeTags(lista: string[]): string {
  return lista.join(", ");
}

// Alguns imports gravam o id numerico interno do autor em vez do @usuario
// (quando a plataforma de origem nao devolve um nome legivel). Isso nunca
// deve aparecer como tag/criador na tela — mas o dado em si fica intacto
// no banco, so a exibicao filtra.
function ehIdentificadorNumerico(valor: string): boolean {
  return /^\d{5,}$/.test(valor.trim());
}
function formatarCriador(valor: string): string {
  return ehIdentificadorNumerico(valor) ? "" : valor;
}
function formatarTags(valor: string): string {
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v && !ehIdentificadorNumerico(v))
    .join(", ");
}

const LIMITE_TAGS_VISIVEIS = 10;

type AbaAdicionar = "tiktok" | "x" | "manual";

export default function MemesPage() {
  const { user } = useUser();
  const toast = useToast();
  const [memes, setMemes] = useState<Meme[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tagAtiva, setTagAtiva] = useState<string | null>(null);
  const [todasTagsVisiveis, setTodasTagsVisiveis] = useState(false);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [imagensQuebradas, setImagensQuebradas] = useState<Set<string>>(new Set());
  const [linkImportar, setLinkImportar] = useState("");
  const [importando, setImportando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [abaAdicionar, setAbaAdicionar] = useState<AbaAdicionar>("tiktok");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

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
    setModalAberto(false);
    carregar();
  }

  async function atualizar(id: string, patch: Partial<{ titulo: string; imagem_url: string | null; link_origem: string | null; explicacao: string; tags: string[]; criador: string | null; categoria: Categoria | null }>) {
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

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  function cancelarSelecao() {
    setModoSelecao(false);
    setSelecionados(new Set());
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Excluir ${selecionados.size} meme(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").delete().in("id", Array.from(selecionados));
    if (error) { toast("Erro ao excluir"); return; }
    toast(`${selecionados.size} meme(s) removido(s)`);
    cancelarSelecao();
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

  async function importarDoX(e: FormEvent) {
    e.preventDefault();
    if (!user || !linkImportar.trim() || importando) return;
    setImportando(true);
    try {
      const respostaInfo = await fetch(`/api/x-import?url=${encodeURIComponent(linkImportar.trim())}`);
      const info = await respostaInfo.json();
      if (!respostaInfo.ok) { toast(info.erro ?? "Não consegui importar esse link"); return; }

      const respostaMidia = await fetch(`/api/x-media?url=${encodeURIComponent(info.midiaUrl)}`);
      if (!respostaMidia.ok) { toast("Não consegui baixar a mídia desse post"); return; }
      const blob = await respostaMidia.blob();
      const extensao = info.tipo === "video" ? "mp4" : "jpg";
      const arquivo = new File([blob], `x-import.${extensao}`, { type: blob.type });

      const urlArquivo = await enviarArquivo("memes", user.id, arquivo);
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("memes").insert({
        user_id: user.id,
        titulo: info.texto ? info.texto.slice(0, 80) : "Novo meme",
        imagem_url: urlArquivo,
        link_origem: linkImportar.trim(),
        explicacao: "",
        tags: info.autor ? [info.autor.toLowerCase()] : [],
        plataforma: "x",
        criador: info.autor || null,
      });
      if (error) { toast("Erro ao salvar o meme"); return; }

      toast("Meme importado — falta só escrever o \"por que funciona\"");
      setLinkImportar("");
      setModalAberto(false);
      carregar();
    } catch {
      toast("Erro ao importar esse link");
    } finally {
      setImportando(false);
    }
  }

  const todasAsTags = Array.from(new Set(memes.flatMap((m) => m.tags)))
    .filter((t) => !ehIdentificadorNumerico(t))
    .sort();
  const tagsParaMostrar = todasTagsVisiveis ? todasAsTags : todasAsTags.slice(0, LIMITE_TAGS_VISIVEIS);
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
          <button
            onClick={() => { setAbaAdicionar("tiktok"); setModalAberto(true); }}
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-teal-500 px-4 text-sm font-medium text-neutral-950 hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        }
      />

      <Modal titulo="Adicionar referência" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <div className="mb-3 flex gap-1 rounded-md bg-neutral-900 p-0.5">
          <button
            onClick={() => setAbaAdicionar("tiktok")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "tiktok" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <Rss className="h-3.5 w-3.5" /> TikTok
          </button>
          <button
            onClick={() => setAbaAdicionar("x")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "x" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <Link2 className="h-3.5 w-3.5" /> X
          </button>
          <button
            onClick={() => setAbaAdicionar("manual")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "manual" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <PencilLine className="h-3.5 w-3.5" /> Manual
          </button>
        </div>

        {abaAdicionar === "tiktok" && <ImportarPerfil />}

        {abaAdicionar === "x" && (
          <form onSubmit={importarDoX} className="flex flex-col gap-2">
            <input
              value={linkImportar}
              onChange={(e) => setLinkImportar(e.target.value)}
              placeholder="Cola o link de um post do X (x.com/.../status/...)"
              className="min-h-[38px] rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-teal-500/40"
            />
            <button
              type="submit"
              disabled={!linkImportar.trim() || importando}
              className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-md bg-teal-500 px-4 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40"
            >
              {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {importando ? "Importando..." : "Importar do X"}
            </button>
          </form>
        )}

        {abaAdicionar === "manual" && (
          <button
            onClick={adicionar}
            className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-700 text-xs text-neutral-400 hover:border-teal-500/40 hover:text-teal-300"
          >
            <Plus className="h-3.5 w-3.5" /> Criar meme em branco e enviar arquivo
          </button>
        )}
      </Modal>

      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, explicação ou tag…"
            className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
          />
        </div>
        <button
          onClick={() => (modoSelecao ? cancelarSelecao() : setModoSelecao(true))}
          className={`flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium ${modoSelecao ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"}`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {modoSelecao ? "Cancelar" : "Selecionar"}
        </button>
      </div>

      {modoSelecao && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-teal-500/30 bg-teal-500/5 px-3 py-2">
          <span className="text-xs text-teal-200">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span>
          <button
            onClick={() => setSelecionados(new Set(filtrados.map((m) => m.id)))}
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            Selecionar tudo
          </button>
          {selecionados.size > 0 && (
            <button onClick={() => setSelecionados(new Set())} className="text-xs text-neutral-400 hover:text-neutral-200">
              Limpar
            </button>
          )}
          <button
            onClick={excluirSelecionados}
            disabled={selecionados.size === 0}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-[#F0997B] px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir {selecionados.size > 0 && `(${selecionados.size})`}
          </button>
        </div>
      )}

      {todasAsTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setTagAtiva(null)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!tagAtiva ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
          >
            Todas
          </button>
          {tagsParaMostrar.map((t) => (
            <button
              key={t}
              onClick={() => setTagAtiva(t === tagAtiva ? null : t)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${tagAtiva === t ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
            >
              #{t}
            </button>
          ))}
          {todasAsTags.length > LIMITE_TAGS_VISIVEIS && (
            <button
              onClick={() => setTodasTagsVisiveis((v) => !v)}
              className="flex items-center gap-0.5 px-1.5 py-1 text-[11px] text-neutral-600 hover:text-neutral-300"
            >
              {todasTagsVisiveis ? "menos" : `+${todasAsTags.length - LIMITE_TAGS_VISIVEIS}`}
              <ChevronDown className={`h-3 w-3 transition-transform ${todasTagsVisiveis ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}

      {user && <ImportActivity userId={user.id} onImportCompleted={carregar} />}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={Sparkles}
          titulo={memes.length === 0 ? "Nenhum meme guardado ainda" : "Nenhum meme encontrado"}
          descricao={memes.length === 0 ? "Clique em “Adicionar” pra começar o acervo." : "Tente buscar por outro termo ou tag."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((m) => (
            <Card key={m.id} className={`relative overflow-hidden p-0 ${modoSelecao && selecionados.has(m.id) ? "ring-2 ring-teal-500" : ""}`}>
              {modoSelecao && (
                <>
                  <div
                    onClick={() => alternarSelecao(m.id)}
                    className="absolute inset-0 z-20 cursor-pointer"
                  />
                  <div
                    className={`pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-md border backdrop-blur-sm ${selecionados.has(m.id) ? "border-teal-500 bg-teal-500 text-neutral-950" : "border-neutral-600 bg-neutral-950/80 text-transparent"}`}
                  >
                    {selecionados.has(m.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 text-neutral-500" />}
                  </div>
                </>
              )}
              <div className="relative flex max-h-[320px] min-h-[180px] w-full items-center justify-center bg-neutral-950 sm:max-h-[380px]">
                {m.imagemUrl && !imagensQuebradas.has(m.imagemUrl) ? (
                  <>
                    {ehVideo(m.imagemUrl) ? (
                      <video
                        src={m.imagemUrl}
                        className="max-h-[320px] w-full object-contain sm:max-h-[380px]"
                        controls
                        playsInline
                        onError={() => setImagensQuebradas((atual) => new Set(atual).add(m.imagemUrl!))}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imagemUrl}
                        alt=""
                        className="max-h-[320px] w-full object-contain sm:max-h-[380px]"
                        onError={() => setImagensQuebradas((atual) => new Set(atual).add(m.imagemUrl!))}
                      />
                    )}
                    {!modoSelecao && (
                      <button
                        onClick={() => fileInputRefs.current[m.id]?.click()}
                        title="Trocar arquivo"
                        className="absolute right-1.5 top-1.5 rounded-md border border-neutral-700/60 bg-neutral-950/80 px-2 py-1 text-[10px] text-neutral-300 backdrop-blur-sm hover:border-teal-500/60 hover:text-teal-300"
                      >
                        Trocar
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRefs.current[m.id]?.click()}
                    className="flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-1.5 text-neutral-700"
                  >
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-[10px]">Clique pra enviar imagem ou vídeo</span>
                  </button>
                )}
                {enviandoId === m.id && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-neutral-300">Enviando...</span>}
                {(m.categoria || m.plataforma) && (
                  <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
                    {m.plataforma && (
                      <span className="rounded-full bg-neutral-950/80 px-2 py-0.5 text-[9px] uppercase tracking-wide text-neutral-400 backdrop-blur-sm">{m.plataforma}</span>
                    )}
                    {m.categoria && (
                      <span className="rounded-full bg-neutral-950/80 px-2 py-0.5 text-[9px] uppercase tracking-wide text-teal-400/90 backdrop-blur-sm">{CATEGORIAS.find((c) => c.id === m.categoria)?.rotulo}</span>
                    )}
                  </div>
                )}
              </div>
              <input
                ref={(el) => { fileInputRefs.current[m.id] = el; }}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(m.id, f); e.target.value = ""; }}
              />

              <div className="space-y-1.5 p-3">
                <EditableField value={m.titulo} onSave={(v) => atualizar(m.id, { titulo: v })} displayClassName="text-sm font-semibold text-neutral-100" />

                <div className="flex items-center gap-1.5">
                  <select
                    value={m.categoria ?? ""}
                    onChange={(e) => atualizar(m.id, { categoria: (e.target.value || null) as Categoria | null })}
                    className="min-h-[24px] rounded-md border border-neutral-800 bg-neutral-900 px-1.5 text-[10px] text-neutral-500 outline-none focus:border-teal-500/40"
                  >
                    <option value="">Sem categoria</option>
                    {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                  <EditableField
                    value={m.criador ?? ""}
                    placeholder="@quem postou"
                    onSave={(v) => atualizar(m.id, { criador: v || null })}
                    formatDisplay={formatarCriador}
                    displayClassName="min-h-[24px] flex-1 px-1.5 py-0 text-[11px] text-neutral-500"
                  />
                </div>

                <EditableField
                  as="textarea"
                  value={m.explicacao}
                  placeholder="Por que esse meme pega…"
                  onSave={(v) => atualizar(m.id, { explicacao: v })}
                  displayClassName="text-xs leading-relaxed text-neutral-400"
                />

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="min-w-0 flex-1">
                    <EditableField
                      value={paraTextoDeTags(m.tags)}
                      placeholder="tags: anime, bbb, copa"
                      onSave={(v) => atualizar(m.id, { tags: paraListaDeTags(v) })}
                      formatDisplay={formatarTags}
                      displayClassName="truncate text-[11px] text-teal-500/80"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {m.linkOrigem && (
                      <a href={m.linkOrigem} target="_blank" rel="noreferrer" className="flex h-7 w-7 items-center justify-center text-neutral-600 hover:text-teal-400">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => { if (window.confirm("Excluir este meme?")) excluir(m.id); }} className="flex h-7 w-7 items-center justify-center text-neutral-600 hover:text-[#F0997B]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
