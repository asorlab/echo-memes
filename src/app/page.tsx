"use client";
import ImportarPerfil from "@/components/memes/ImportarPerfil";
import ImportActivity from "@/components/memes/ImportActivity";
import MemeDrawer from "@/components/memes/MemeDrawer";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Plus, Trash2, Sparkles, Search, Download, Loader2, Link2, PencilLine, Rss, CheckSquare, Square,
  Star, Clock, Smartphone, MonitorPlay, Volume2, VolumeX, Mic, MicOff, History,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/apiFetch";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import { enviarArquivo, resolverUrl, urlAssinada, urlsAssinadas, ehCaminhoInterno } from "@/lib/storage";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import type {
  Categoria, Emocao, Momento, Formato, FormaUso, AudioPref, Intensidade, Status, Risco, Orientacao, Meme, MemeUso,
} from "@/lib/types";

interface MemeRow {
  id: string; user_id: string; titulo: string; imagem_url: string | null;
  link_origem: string | null; explicacao: string; tags: string[]; created_at: string;
  plataforma: string | null; criador: string | null; categoria: Categoria | null; publicado_em: string | null;
  emocao: Emocao | null; momento: Momento | null; formatos: Formato[]; forma_uso: FormaUso[];
  audio_pref: AudioPref | null; ideia_uso: string | null; intensidade: Intensidade | null;
  favorito: boolean; status: Status; risco: Risco | null;
  duracao_seg: number | null; orientacao: Orientacao | null; tem_audio: boolean | null; tem_fala: boolean | null;
  corte_inicio: number | null; corte_fim: number | null;
}

interface MemeUsoRow {
  id: string; meme_id: string; contexto: string; data: string;
}

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
    emocao: r.emocao, momento: r.momento, formatos: r.formatos ?? [], formaUso: r.forma_uso ?? [],
    audioPref: r.audio_pref, ideiaUso: r.ideia_uso, intensidade: r.intensidade,
    favorito: r.favorito, status: r.status, risco: r.risco,
    duracaoSeg: r.duracao_seg, orientacao: r.orientacao, temAudio: r.tem_audio, temFala: r.tem_fala,
    corteInicio: r.corte_inicio, corteFim: r.corte_fim,
  };
}
function mapUso(r: MemeUsoRow): MemeUso {
  return { id: r.id, memeId: r.meme_id, contexto: r.contexto, data: r.data };
}

// Alguns imports gravam o id numerico interno do autor em vez do @usuario.
function ehIdentificadorNumerico(valor: string): boolean {
  return /^\d{5,}$/.test(valor.trim());
}

function extrairMetadadosVideo(arquivo: File): Promise<{ duracao: number; orientacao: Orientacao } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duracao = video.duration;
      const orientacao: Orientacao = video.videoWidth >= video.videoHeight ? "horizontal" : "vertical";
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(duracao) ? { duracao, orientacao } : null);
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(arquivo);
  });
}

function slugify(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "meme";
}

const EMOCOES: { id: Emocao; rotulo: string }[] = [
  { id: "vergonha", rotulo: "Vergonha" }, { id: "choque", rotulo: "Choque" }, { id: "deboche", rotulo: "Deboche" },
  { id: "deu_ruim", rotulo: "Deu ruim" }, { id: "vitoria", rotulo: "Vitória" }, { id: "cansaco", rotulo: "Cansaço" }, { id: "ironia", rotulo: "Ironia" },
];

type FiltroRapido = "reacoes" | "punchlines" | "deu_ruim" | "gaming" | "vlog" | "nunca_usados" | "favoritos" | "baixo_risco";
const FILTROS_RAPIDOS: { id: FiltroRapido; rotulo: string }[] = [
  { id: "reacoes", rotulo: "Reações" },
  { id: "punchlines", rotulo: "Punchlines rápidas" },
  { id: "deu_ruim", rotulo: "Deu ruim" },
  { id: "gaming", rotulo: "Gaming" },
  { id: "vlog", rotulo: "Vlog" },
  { id: "nunca_usados", rotulo: "Nunca usados" },
  { id: "favoritos", rotulo: "Favoritos" },
  { id: "baixo_risco", rotulo: "Baixo risco" },
];

type AbaAdicionar = "tiktok" | "x" | "manual";

export default function MemesPage() {
  const { user } = useUser();
  const toast = useToast();
  const [memes, setMemes] = useState<Meme[]>([]);
  const [usos, setUsos] = useState<MemeUso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [emocaoAtiva, setEmocaoAtiva] = useState<Emocao | null>(null);
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [imagensQuebradas, setImagensQuebradas] = useState<Set<string>>(new Set());
  const [linkImportar, setLinkImportar] = useState("");
  const [importando, setImportando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [abaAdicionar, setAbaAdicionar] = useState<AbaAdicionar>("tiktok");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const primeiraCarga = useRef(true);
  const carregar = useCallback(async () => {
    if (!user) return;
    if (primeiraCarga.current) setCarregando(true);
    const supabase = supabaseBrowser();
    const [{ data, error }, { data: usosData }] = await Promise.all([
      supabase.from("memes").select("*").eq("user_id", user.id).is("excluido_em", null).order("created_at", { ascending: false }),
      supabase.from("memes_usos").select("*").eq("user_id", user.id).order("data", { ascending: false }),
    ]);
    setCarregando(false);
    primeiraCarga.current = false;
    if (error) {
      // Nunca esvazia a lista em cima de um erro de carregamento — senao
      // um problema passageiro (ou uma coluna faltando) parece "sumiu tudo".
      toast(`Erro ao carregar memes: ${error.message}`);
      return;
    }
    const memesCarregados = ((data as MemeRow[]) ?? []).map(mapMeme);
    setMemes(memesCarregados);
    setUsos(((usosData as MemeUsoRow[]) ?? []).map(mapUso));
    urlsAssinadas(memesCarregados.map((m) => m.imagemUrl)).then(setUrls);
  }, [user, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!user) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").insert({ user_id: user.id, titulo: "Novo meme", explicacao: "" });
    if (error) { toast("Erro ao criar"); return; }
    setModalAberto(false);
    carregar();
  }

  async function atualizar(id: string, patch: Partial<{
    titulo: string; imagem_url: string | null; link_origem: string | null; explicacao: string; tags: string[];
    criador: string | null; categoria: Categoria | null; emocao: Emocao | null; momento: Momento | null;
    formatos: Formato[]; forma_uso: FormaUso[]; audio_pref: AudioPref | null; ideia_uso: string | null;
    intensidade: Intensidade | null; favorito: boolean; status: Status; risco: Risco | null;
    duracao_seg: number | null; orientacao: Orientacao | null; tem_audio: boolean | null; tem_fala: boolean | null;
    corte_inicio: number | null; corte_fim: number | null;
  }>) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").update(patch).eq("id", id);
    if (error) { toast("Erro ao salvar"); return; }
    carregar();
  }

  async function excluir(id: string) {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").update({ excluido_em: new Date().toISOString() }).eq("id", id);
    if (error) { toast("Erro ao excluir"); return; }
    toast("Movido pra lixeira");
    if (drawerId === id) setDrawerId(null);
    carregar();
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function cancelarSelecao() { setModoSelecao(false); setSelecionados(new Set()); }
  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Excluir ${selecionados.size} meme(s) selecionado(s)? Vao pra lixeira, da pra restaurar depois.`)) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes").update({ excluido_em: new Date().toISOString() }).in("id", Array.from(selecionados));
    if (error) { toast("Erro ao excluir"); return; }
    toast(`${selecionados.size} meme(s) movido(s) pra lixeira`);
    cancelarSelecao();
    carregar();
  }

  async function enviarImagem(id: string, arquivo: File) {
    if (!user) return;
    setEnviandoId(id);
    try {
      const [url, metadados] = await Promise.all([
        enviarArquivo("memes", user.id, arquivo),
        arquivo.type.startsWith("video/") ? extrairMetadadosVideo(arquivo) : Promise.resolve(null),
      ]);
      await atualizar(id, {
        imagem_url: url,
        ...(metadados ? { duracao_seg: Math.round(metadados.duracao * 10) / 10, orientacao: metadados.orientacao } : {}),
      });
    } catch {
      toast("Erro ao enviar imagem");
    } finally {
      setEnviandoId(null);
    }
  }

  async function registrarUso(memeId: string, contexto: string) {
    if (!user) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("memes_usos").insert({ meme_id: memeId, user_id: user.id, contexto });
    if (error) { toast("Erro ao registrar uso"); return; }
    const meme = memes.find((m) => m.id === memeId);
    if (meme && meme.status !== "usado") await atualizar(memeId, { status: "usado" });
    else carregar();
  }
  async function excluirUso(id: string) {
    const supabase = supabaseBrowser();
    await supabase.from("memes_usos").delete().eq("id", id);
    carregar();
  }

  async function baixarMeme(meme: Meme) {
    if (!meme.imagemUrl) return;
    const partes = [meme.emocao ?? "meme", meme.duracaoSeg ? `${Math.round(meme.duracaoSeg)}s` : null, meme.orientacao].filter(Boolean);
    const extensao = meme.imagemUrl.split("?")[0].split(".").pop() || "mp4";
    const nomeArquivo = `${slugify(partes.join("_"))}.${extensao}`;
    const urlParaBaixar = resolverUrl(meme.imagemUrl, urls) ?? (ehCaminhoInterno(meme.imagemUrl) ? await urlAssinada(meme.imagemUrl) : null);
    if (!urlParaBaixar) { toast("Erro ao baixar"); return; }
    try {
      const resposta = await fetch(urlParaBaixar);
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nomeArquivo;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast("Erro ao baixar, abrindo em nova aba");
      window.open(urlParaBaixar, "_blank");
    }
  }

  async function importarDoX(e: FormEvent) {
    e.preventDefault();
    if (!user || !linkImportar.trim() || importando) return;
    setImportando(true);
    try {
      const respostaInfo = await apiFetch(`/api/x-import?url=${encodeURIComponent(linkImportar.trim())}`);
      const info = await respostaInfo.json();
      if (!respostaInfo.ok) { toast(info.erro ?? "Não consegui importar esse link"); return; }

      const respostaMidia = await apiFetch(`/api/x-media?url=${encodeURIComponent(info.midiaUrl)}`);
      if (!respostaMidia.ok) { toast("Não consegui baixar a mídia desse post"); return; }
      const blob = await respostaMidia.blob();
      const extensao = info.tipo === "video" ? "mp4" : "jpg";
      const arquivo = new File([blob], `x-import.${extensao}`, { type: blob.type });

      const [urlArquivo, metadados] = await Promise.all([
        enviarArquivo("memes", user.id, arquivo),
        arquivo.type.startsWith("video/") ? extrairMetadadosVideo(arquivo) : Promise.resolve(null),
      ]);
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
        ...(metadados ? { duracao_seg: Math.round(metadados.duracao * 10) / 10, orientacao: metadados.orientacao } : {}),
      });
      if (error) { toast("Erro ao salvar o meme"); return; }

      toast("Meme importado: falta só classificar");
      setLinkImportar("");
      setModalAberto(false);
      carregar();
    } catch {
      toast("Erro ao importar esse link");
    } finally {
      setImportando(false);
    }
  }

  const usosPorMeme = useMemo(() => {
    const mapa: Record<string, MemeUso[]> = {};
    for (const u of usos) (mapa[u.memeId] ??= []).push(u);
    return mapa;
  }, [usos]);

  const filtrados = memes.filter((m) => {
    if (emocaoAtiva && m.emocao !== emocaoAtiva) return false;
    const usosDoMeme = usosPorMeme[m.id] ?? [];
    if (filtroRapido === "reacoes" && !m.emocao) return false;
    if (filtroRapido === "punchlines" && !(m.momento === "punchline" && (m.duracaoSeg ?? 99) <= 3)) return false;
    if (filtroRapido === "deu_ruim" && m.emocao !== "deu_ruim") return false;
    if (filtroRapido === "gaming" && !m.formatos.includes("gaming")) return false;
    if (filtroRapido === "vlog" && !m.formatos.includes("vlog")) return false;
    if (filtroRapido === "nunca_usados" && usosDoMeme.length > 0) return false;
    if (filtroRapido === "favoritos" && !m.favorito) return false;
    if (filtroRapido === "baixo_risco" && m.risco !== "baixo") return false;
    if (!busca.trim()) return true;
    const alvo = busca.trim().toLowerCase();
    return m.titulo.toLowerCase().includes(alvo) || m.explicacao.toLowerCase().includes(alvo) ||
      (m.ideiaUso ?? "").toLowerCase().includes(alvo) || m.tags.some((t) => t.includes(alvo) && !ehIdentificadorNumerico(t));
  });

  const memeDrawer = drawerId ? memes.find((m) => m.id === drawerId) ?? null : null;

  return (
    <div>
      <PageHeader
        titulo="Memes"
        descricao="Biblioteca de memes pensada pro momento da edição, classifica, encontra, corta, baixa."
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
          <button onClick={() => setAbaAdicionar("tiktok")} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "tiktok" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}>
            <Rss className="h-3.5 w-3.5" /> TikTok
          </button>
          <button onClick={() => setAbaAdicionar("x")} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "x" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}>
            <Link2 className="h-3.5 w-3.5" /> X
          </button>
          <button onClick={() => setAbaAdicionar("manual")} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${abaAdicionar === "manual" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}>
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
            <button type="submit" disabled={!linkImportar.trim() || importando} className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-md bg-teal-500 px-4 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40">
              {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {importando ? "Importando..." : "Importar do X"}
            </button>
          </form>
        )}

        {abaAdicionar === "manual" && (
          <button onClick={adicionar} className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-700 text-xs text-neutral-400 hover:border-teal-500/40 hover:text-teal-300">
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
            placeholder="Buscar por título, ideia de uso ou tag…"
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
          <button onClick={() => setSelecionados(new Set(filtrados.map((m) => m.id)))} className="text-xs text-neutral-400 hover:text-neutral-200">Selecionar tudo</button>
          {selecionados.size > 0 && <button onClick={() => setSelecionados(new Set())} className="text-xs text-neutral-400 hover:text-neutral-200">Limpar</button>}
          <button onClick={excluirSelecionados} disabled={selecionados.size === 0} className="ml-auto flex items-center gap-1.5 rounded-md bg-[#F0997B] px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> Excluir {selecionados.size > 0 && `(${selecionados.size})`}
          </button>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setEmocaoAtiva(null)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${!emocaoAtiva ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
          Todas emoções
        </button>
        {EMOCOES.map((e) => (
          <button key={e.id} onClick={() => setEmocaoAtiva(e.id === emocaoAtiva ? null : e.id)} className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${emocaoAtiva === e.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}>
            {e.rotulo}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS_RAPIDOS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroRapido(f.id === filtroRapido ? null : f.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${filtroRapido === f.id ? "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {user && <ImportActivity userId={user.id} onImportCompleted={carregar} />}

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={Sparkles}
          titulo={memes.length === 0 ? "Nenhum meme guardado ainda" : "Nenhum meme encontrado"}
          descricao={memes.length === 0 ? "Clique em “Adicionar” pra começar o acervo." : "Tente buscar por outro termo ou filtro."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtrados.map((m) => {
            const usosDoMeme = usosPorMeme[m.id] ?? [];
            return (
              <Card key={m.id} className={`relative overflow-hidden p-0 ${modoSelecao && selecionados.has(m.id) ? "ring-2 ring-teal-500" : ""}`}>
                {modoSelecao && (
                  <>
                    <div onClick={() => alternarSelecao(m.id)} className="absolute inset-0 z-20 cursor-pointer" />
                    <div className={`pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-md border backdrop-blur-sm ${selecionados.has(m.id) ? "border-teal-500 bg-teal-500 text-neutral-950" : "border-neutral-600 bg-neutral-950/80 text-transparent"}`}>
                      {selecionados.has(m.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 text-neutral-500" />}
                    </div>
                  </>
                )}
                <button
                  onClick={() => !modoSelecao && setDrawerId(m.id)}
                  className="relative flex h-[160px] w-full items-center justify-center bg-neutral-950 sm:h-[190px]"
                >
                  {m.imagemUrl && resolverUrl(m.imagemUrl, urls) && !imagensQuebradas.has(m.imagemUrl) ? (
                    ehVideo(m.imagemUrl) ? (
                      <video src={resolverUrl(m.imagemUrl, urls)} className="h-full w-full object-cover" muted playsInline onError={() => setImagensQuebradas((atual) => new Set(atual).add(m.imagemUrl!))} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolverUrl(m.imagemUrl, urls)} alt="" className="h-full w-full object-cover" onError={() => setImagensQuebradas((atual) => new Set(atual).add(m.imagemUrl!))} />
                    )
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-neutral-700">
                      <Sparkles className="h-5 w-5" />
                      <span className="text-[10px]">{m.imagemUrl ? "arquivo indisponível" : "sem arquivo"}</span>
                    </div>
                  )}
                  {enviandoId === m.id && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-neutral-300">Enviando...</span>}

                  <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                    {m.duracaoSeg != null && (
                      <span className="flex items-center gap-0.5 rounded-full bg-neutral-950/80 px-1.5 py-0.5 text-[9px] text-neutral-300 backdrop-blur-sm">
                        <Clock className="h-2.5 w-2.5" /> {Math.round(m.duracaoSeg * 10) / 10}s
                      </span>
                    )}
                    {m.orientacao && (
                      <span className="flex items-center rounded-full bg-neutral-950/80 px-1.5 py-0.5 text-neutral-300 backdrop-blur-sm">
                        {m.orientacao === "vertical" ? <Smartphone className="h-2.5 w-2.5" /> : <MonitorPlay className="h-2.5 w-2.5" />}
                      </span>
                    )}
                  </div>
                  <div className="pointer-events-none absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
                    {m.favorito && <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />}
                  </div>
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
                    {m.temAudio != null && (m.temAudio ? <Volume2 className="h-3 w-3 text-neutral-300" /> : <VolumeX className="h-3 w-3 text-neutral-500" />)}
                    {m.temFala != null && (m.temFala ? <Mic className="h-3 w-3 text-neutral-300" /> : <MicOff className="h-3 w-3 text-neutral-500" />)}
                  </div>
                  {m.risco && (
                    <span
                      title={`Risco ${m.risco}`}
                      className={`pointer-events-none absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ${m.risco === "alto" ? "bg-[#F0997B]" : m.risco === "medio" ? "bg-amber-400" : "bg-teal-400"}`}
                    />
                  )}
                </button>

                <div className="space-y-1 p-2.5">
                  <p className="truncate text-xs font-semibold text-neutral-100">{m.titulo}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {m.emocao && <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-[9px] text-teal-300">{EMOCOES.find((e) => e.id === m.emocao)?.rotulo}</span>}
                    {m.momento && <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-300">{m.momento}</span>}
                    {m.formatos.map((f) => <span key={f} className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400">{f}</span>)}
                  </div>
                  <div className="flex items-center justify-between pt-0.5 text-[10px] text-neutral-600">
                    <span className="flex items-center gap-1">
                      <History className="h-2.5 w-2.5" /> {usosDoMeme.length === 0 ? "nunca usado" : `${usosDoMeme.length}x`}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); baixarMeme(m); }}
                      className="flex h-6 w-6 items-center justify-center text-neutral-600 hover:text-teal-400"
                      title="Baixar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  ref={(el) => { fileInputRefs.current[m.id] = el; }}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(m.id, f); e.target.value = ""; }}
                />
              </Card>
            );
          })}
        </div>
      )}

      {memeDrawer && (
        <MemeDrawer
          meme={memeDrawer}
          arquivoUrlResolvido={resolverUrl(memeDrawer.imagemUrl, urls) ?? null}
          usos={usosPorMeme[memeDrawer.id] ?? []}
          onFechar={() => setDrawerId(null)}
          onAtualizar={(patch) => atualizar(memeDrawer.id, patch)}
          onTrocarArquivo={(arquivo) => enviarImagem(memeDrawer.id, arquivo)}
          onExcluir={() => excluir(memeDrawer.id)}
          onBaixar={() => baixarMeme(memeDrawer)}
          onRegistrarUso={(contexto) => registrarUso(memeDrawer.id, contexto)}
          onExcluirUso={excluirUso}
        />
      )}
    </div>
  );
}
