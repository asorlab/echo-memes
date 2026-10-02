"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Trash2, Plus, FileText, Flag, Scissors, ClipboardCheck, Send, BarChart3,
  CheckCircle2, XCircle, RotateCcw, AlertCircle,
} from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import {
  listarBrutosDoProjeto, listarProducaoProjetos, atualizarProducaoProjeto, excluirProducaoProjeto,
  obterTranscricao, criarTranscricao, listarSegmentos,
  listarMomentos, criarMomento, atualizarMomento, excluirMomento,
  listarClips, criarClip, atualizarClip, excluirClip,
  listarFeedbacks, criarFeedback,
  listarPublicacoes, criarPublicacao, atualizarPublicacao, excluirPublicacao, listarMetricas, adicionarMetrica,
  listarDnas,
} from "@/lib/production/data";
import type {
  Bruto, ProducaoProjeto, Transcricao, SegmentoTranscricao, Momento, Clip, Feedback,
  Publicacao, Metrica, EditingDna, CategoriaMomento, FormatoClip, StatusClip, TipoFeedback,
} from "@/lib/production/types";

type Tab = "originais" | "transcricao" | "momentos" | "cortes" | "review" | "publicacao" | "metricas";
const TABS: { id: Tab; nome: string; icone: typeof FileText }[] = [
  { id: "originais", nome: "Originais", icone: FileText },
  { id: "transcricao", nome: "Transcrição", icone: FileText },
  { id: "momentos", nome: "Momentos", icone: Flag },
  { id: "cortes", nome: "Cortes", icone: Scissors },
  { id: "review", nome: "Review", icone: ClipboardCheck },
  { id: "publicacao", nome: "Publicação", icone: Send },
  { id: "metricas", nome: "Métricas", icone: BarChart3 },
];

const CATEGORIAS_MOMENTO: CategoriaMomento[] = ["hook", "engracado", "fashion", "grwm", "historia", "informativo", "emocional", "visual", "outro"];
const EMOJI_CATEGORIA: Record<CategoriaMomento, string> = {
  hook: "🔥", engracado: "😂", fashion: "👗", grwm: "💄", historia: "📖", informativo: "ℹ️", emocional: "💛", visual: "🎨", outro: "•",
};
const FORMATOS_CLIP: FormatoClip[] = ["tiktok", "reel", "short", "youtube", "custom"];
const STATUS_CLIP: StatusClip[] = ["draft", "queued", "processing", "review", "approved", "rejected", "exported"];

function formatarMs(ms: number): string {
  const totalSeg = Math.floor(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min}:${seg.toString().padStart(2, "0")}`;
}

export default function ProductionProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("originais");
  const [projeto, setProjeto] = useState<ProducaoProjeto | null>(null);
  const [brutos, setBrutos] = useState<Bruto[]>([]);
  const [dnas, setDnas] = useState<EditingDna[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const [todos, b, d] = await Promise.all([listarProducaoProjetos(user.id), listarBrutosDoProjeto(id), listarDnas(user.id)]);
    setProjeto(todos.find((p) => p.id === id) ?? null);
    setBrutos(b);
    setDnas(d);
    setCarregando(false);
  }, [user, id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(patch: Partial<ProducaoProjeto>) {
    await atualizarProducaoProjeto(id, patch);
    carregar();
  }
  async function excluir() {
    if (!window.confirm("Excluir este projeto de produção? Os brutos originais não são apagados.")) return;
    await excluirProducaoProjeto(id);
    toast("Projeto excluído");
    router.push("/production");
  }

  if (carregando) return <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>;
  if (!projeto) return <EmptyState icone={AlertCircle} titulo="Projeto não encontrado" />;

  return (
    <div>
      <button onClick={() => router.push("/production")} className="mb-4 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Production
      </button>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <EditableField value={projeto.titulo} onSave={(v) => salvar({ titulo: v })} displayClassName="text-lg font-semibold text-neutral-100" />
          <button onClick={excluir} className="shrink-0 text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <p className="mb-1 text-[10px] uppercase text-neutral-600">Tipo</p>
            <select value={projeto.tipo ?? ""} onChange={(e) => salvar({ tipo: (e.target.value || null) as ProducaoProjeto["tipo"] })} className="min-h-[32px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
              <option value="">—</option>
              {["vlog", "grwm", "fashion", "gaming", "cover", "asmr", "lifestyle", "outro"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase text-neutral-600">Status</p>
            <select value={projeto.status} onChange={(e) => salvar({ status: e.target.value as ProducaoProjeto["status"] })} className="min-h-[32px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
              {["rascunho", "preparando", "processando", "revisao", "aprovado", "exportado", "publicado"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase text-neutral-600">Editing DNA</p>
            <select value={projeto.dna_id ?? ""} onChange={(e) => salvar({ dna_id: e.target.value || null })} className="min-h-[32px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
              <option value="">—</option>
              {dnas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase text-neutral-600">Data</p>
            <input type="date" value={projeto.data ?? ""} onChange={(e) => salvar({ data: e.target.value || null })} className="min-h-[32px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-300 outline-none focus:border-teal-500/40" />
          </div>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-mono transition-colors ${tab === t.id ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
            <t.icone className="h-3 w-3" /> {t.nome}
          </button>
        ))}
      </div>

      {tab === "originais" && <AbaOriginais brutos={brutos} />}
      {tab === "transcricao" && <AbaTranscricao brutos={brutos} userId={user!.id} />}
      {tab === "momentos" && <AbaMomentos brutos={brutos} userId={user!.id} />}
      {tab === "cortes" && <AbaCortes projeto={projeto} brutos={brutos} userId={user!.id} />}
      {tab === "review" && <AbaReview projeto={projeto} userId={user!.id} />}
      {tab === "publicacao" && <AbaPublicacao projeto={projeto} userId={user!.id} />}
      {tab === "metricas" && <AbaMetricas projeto={projeto} userId={user!.id} />}
    </div>
  );
}

function AbaOriginais({ brutos }: { brutos: Bruto[] }) {
  if (brutos.length === 0) return <EmptyState icone={FileText} titulo="Nenhum bruto associado" descricao="Volte pra Inbox e associe um vídeo bruto a este projeto." />;
  return (
    <div className="space-y-1.5">
      {brutos.map((b) => (
        <Card key={b.id} className="flex items-center justify-between p-3">
          <div>
            <p className="text-sm text-neutral-200">{b.nome}</p>
            <p className="text-[11px] text-neutral-500">{b.duracao_seg != null ? `${Math.round(b.duracao_seg / 60)}min` : "duração desconhecida"}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AbaTranscricao({ brutos, userId }: { brutos: Bruto[]; userId: string }) {
  const toast = useToast();
  const [brutoId, setBrutoId] = useState(brutos[0]?.id ?? "");
  const [transcricao, setTranscricao] = useState<Transcricao | null>(null);
  const [segmentos, setSegmentos] = useState<SegmentoTranscricao[]>([]);

  const carregar = useCallback(async () => {
    if (!brutoId) return;
    const t = await obterTranscricao(brutoId);
    setTranscricao(t);
    setSegmentos(t ? await listarSegmentos(t.id) : []);
  }, [brutoId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function iniciar() {
    const t = await criarTranscricao(userId, brutoId);
    setTranscricao(t);
    toast("Registro de transcrição criado — processamento real ainda não está conectado a nenhum provider");
  }

  if (brutos.length === 0) return <EmptyState icone={FileText} titulo="Associe um bruto primeiro" />;

  return (
    <div>
      <select value={brutoId} onChange={(e) => setBrutoId(e.target.value)} className="mb-3 min-h-[36px] rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
        {brutos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
      </select>
      <Card className="p-4">
        {!transcricao ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-xs text-neutral-500">Nenhuma transcrição ainda. Nenhum provider de transcrição está conectado nesta rodada — isso cria só o registro pra estrutura, sem processar nada de verdade.</p>
            <button onClick={iniciar} className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-teal-300 hover:bg-teal-500/10">Criar registro de transcrição</button>
          </div>
        ) : transcricao.status !== "pronto" ? (
          <p className="py-6 text-center text-xs text-amber-400/80">Transcrição: {transcricao.status.replace("_", " ")} — precisa de processamento/provider conectado pra avançar.</p>
        ) : segmentos.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-600">Sem segmentos ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {segmentos.map((s) => (
              <div key={s.id} className="border-b border-neutral-900 py-1.5 text-xs last:border-0">
                <span className="font-mono text-neutral-600">{formatarMs(s.start_ms)} → {formatarMs(s.end_ms)}</span>
                <p className="text-neutral-300">&quot;{s.texto}&quot;</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AbaMomentos({ brutos, userId }: { brutos: Bruto[]; userId: string }) {
  const [brutoId, setBrutoId] = useState(brutos[0]?.id ?? "");
  const [momentos, setMomentos] = useState<Momento[]>([]);

  const carregar = useCallback(async () => {
    if (!brutoId) return;
    setMomentos(await listarMomentos(brutoId));
  }, [brutoId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    await criarMomento(userId, brutoId, { titulo: "Novo momento", categoria: "outro" });
    carregar();
  }
  async function salvar(id: string, patch: Partial<Momento>) {
    await atualizarMomento(id, patch);
    carregar();
  }
  async function remover(id: string) {
    await excluirMomento(id);
    carregar();
  }

  if (brutos.length === 0) return <EmptyState icone={Flag} titulo="Associe um bruto primeiro" />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <select value={brutoId} onChange={(e) => setBrutoId(e.target.value)} className="min-h-[36px] rounded-md border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
          {brutos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
        <button onClick={adicionar} className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-neutral-800 px-3 text-xs text-neutral-400 hover:text-teal-300"><Plus className="h-3.5 w-3.5" /> Momento</button>
      </div>
      {momentos.length === 0 ? (
        <EmptyState icone={Flag} titulo="Nenhum momento ainda" descricao="Cadastre manualmente, ou aguarde um provider de análise futuro." />
      ) : (
        <div className="space-y-1.5">
          {momentos.map((m) => (
            <Card key={m.id} className="p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="shrink-0 text-lg">{EMOJI_CATEGORIA[m.categoria ?? "outro"]}</span>
                <div className="min-w-0 flex-1">
                  <EditableField value={m.titulo} onSave={(v) => salvar(m.id, { titulo: v })} displayClassName="text-sm text-neutral-100" />
                </div>
                <button onClick={() => remover(m.id)} className="shrink-0 text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input type="number" placeholder="início (ms)" value={m.start_ms} onChange={(e) => salvar(m.id, { start_ms: Number(e.target.value) })} className="min-h-[32px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
                <input type="number" placeholder="fim (ms)" value={m.end_ms} onChange={(e) => salvar(m.id, { end_ms: Number(e.target.value) })} className="min-h-[32px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
                <select value={m.categoria ?? ""} onChange={(e) => salvar(m.id, { categoria: e.target.value as CategoriaMomento })} className="min-h-[32px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs text-neutral-300 outline-none focus:border-teal-500/40">
                  {CATEGORIAS_MOMENTO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-neutral-600">{formatarMs(m.start_ms)}–{formatarMs(m.end_ms)} {m.score != null && `· score interno ${m.score}`}</span>
                <select value={m.status} onChange={(e) => salvar(m.id, { status: e.target.value as Momento["status"] })} className="min-h-[28px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-400 outline-none focus:border-teal-500/40">
                  <option value="sugerido">Sugerido</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AbaCortes({ projeto, brutos, userId }: { projeto: ProducaoProjeto; brutos: Bruto[]; userId: string }) {
  const [clips, setClips] = useState<Clip[]>([]);

  const carregar = useCallback(async () => setClips(await listarClips(projeto.id)), [projeto.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!brutos[0]) return;
    await criarClip({ user_id: userId, projeto_id: projeto.id, bruto_id: brutos[0].id, momento_id: null, start_ms: 0, end_ms: 0, nome: "Novo corte", formato: "tiktok", aspect_ratio: "9:16", status: "draft", derivado_id: null });
    carregar();
  }
  async function salvar(id: string, patch: Partial<Clip>) {
    await atualizarClip(id, patch);
    carregar();
  }
  async function remover(id: string) {
    await excluirClip(id);
    carregar();
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={adicionar} disabled={brutos.length === 0} className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-neutral-800 px-3 text-xs text-neutral-400 hover:text-teal-300 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Corte</button>
      </div>
      {clips.length === 0 ? (
        <EmptyState icone={Scissors} titulo="Nenhum corte ainda" descricao="Um momento aprovado pode virar um corte — ou crie manualmente." />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {clips.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <EditableField value={c.nome} onSave={(v) => salvar(c.id, { nome: v })} displayClassName="text-sm text-neutral-100" />
                <button onClick={() => remover(c.id)} className="shrink-0 text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <p className="mb-1.5 text-[11px] text-neutral-500">{formatarMs(c.start_ms)}–{formatarMs(c.end_ms)}</p>
              <div className="grid grid-cols-2 gap-1.5">
                <select value={c.formato} onChange={(e) => salvar(c.id, { formato: e.target.value as FormatoClip })} className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-300 outline-none focus:border-teal-500/40">
                  {FORMATOS_CLIP.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={c.status} onChange={(e) => salvar(c.id, { status: e.target.value as StatusClip })} className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-300 outline-none focus:border-teal-500/40">
                  {STATUS_CLIP.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {c.status !== "exported" && <p className="mt-1.5 text-[10px] text-neutral-600">Sem renderizador conectado — status é só controle manual por enquanto.</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const MOTIVOS_FEEDBACK = ["cortou cedo", "cortou tarde", "zoom bom", "zoom ruim", "legenda exagerada", "legenda boa", "ritmo lento", "ritmo bom", "hook bom", "hook fraco", "outro"];

function AbaReview({ projeto, userId }: { projeto: ProducaoProjeto; userId: string }) {
  const toast = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [feedbackAbertoId, setFeedbackAbertoId] = useState<string | null>(null);
  const [tipoFeedback, setTipoFeedback] = useState<TipoFeedback>("ajustar");
  const [tagsFeedback, setTagsFeedback] = useState<Set<string>>(new Set());
  const [comentario, setComentario] = useState("");

  const carregar = useCallback(async () => setClips((await listarClips(projeto.id)).filter((c) => c.status !== "draft")), [projeto.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(id: string, status: StatusClip) {
    await atualizarClip(id, { status });
    carregar();
  }

  function alternarTag(tag: string) {
    setTagsFeedback((prev) => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n; });
  }

  async function salvarFeedback(clipId: string) {
    await criarFeedback(userId, clipId, { tipo: tipoFeedback, tags: Array.from(tagsFeedback), comentario: comentario || null });
    toast("Feedback registrado");
    setFeedbackAbertoId(null);
    setTagsFeedback(new Set());
    setComentario("");
  }

  if (clips.length === 0) return <EmptyState icone={ClipboardCheck} titulo="Nada pra revisar ainda" descricao="Cortes em fila/revisão aparecem aqui." />;

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">{projeto.titulo} — {clips.length} corte(s) encontrados</p>
      <div className="space-y-2">
        {clips.map((c) => (
          <Card key={c.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-neutral-100">{c.nome}</p>
                <p className="text-[11px] text-neutral-500">{formatarMs(c.start_ms)}–{formatarMs(c.end_ms)} · {c.formato} · status: {c.status}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => mudarStatus(c.id, "approved")} title="Aprovar" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-teal-500/10 hover:text-teal-400"><CheckCircle2 className="h-4 w-4" /></button>
                <button onClick={() => mudarStatus(c.id, "draft")} title="Reeditar" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-amber-500/10 hover:text-amber-400"><RotateCcw className="h-4 w-4" /></button>
                <button onClick={() => mudarStatus(c.id, "rejected")} title="Descartar" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-[#F0997B1A] hover:text-[#F0997B]"><XCircle className="h-4 w-4" /></button>
              </div>
            </div>
            <button onClick={() => setFeedbackAbertoId(feedbackAbertoId === c.id ? null : c.id)} className="mt-2 text-[11px] text-neutral-500 hover:text-teal-300">
              {feedbackAbertoId === c.id ? "Cancelar feedback" : "+ Registrar feedback"}
            </button>
            {feedbackAbertoId === c.id && (
              <div className="mt-2 space-y-2 rounded-md border border-neutral-800 bg-neutral-950/40 p-2">
                <div className="flex gap-1.5">
                  {(["gostei", "nao_gostei", "ajustar"] as TipoFeedback[]).map((t) => (
                    <button key={t} onClick={() => setTipoFeedback(t)} className={`rounded-full border px-2 py-0.5 text-[10px] ${tipoFeedback === t ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{t.replace("_", " ")}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {MOTIVOS_FEEDBACK.map((tag) => (
                    <button key={tag} onClick={() => alternarTag(tag)} className={`rounded-full border px-2 py-0.5 text-[10px] ${tagsFeedback.has(tag) ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}>{tag}</button>
                  ))}
                </div>
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="comentário curto…" className="min-h-[50px] w-full rounded border border-neutral-800 bg-neutral-950 p-1.5 text-xs text-neutral-200 outline-none focus:border-teal-500/40" />
                <button onClick={() => salvarFeedback(c.id)} className="rounded-md bg-teal-500 px-3 py-1.5 text-[11px] font-medium text-neutral-950 hover:opacity-90">Salvar feedback</button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function AbaPublicacao({ projeto, userId }: { projeto: ProducaoProjeto; userId: string }) {
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);

  const carregar = useCallback(async () => setPublicacoes((await listarPublicacoes(userId)).filter((p) => p.projeto_id === projeto.id)), [userId, projeto.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    await criarPublicacao(userId, projeto.id, {});
    carregar();
  }
  async function salvar(id: string, patch: Partial<Publicacao>) {
    await atualizarPublicacao(id, patch);
    carregar();
  }
  async function remover(id: string) {
    await excluirPublicacao(id);
    carregar();
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={adicionar} className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-neutral-800 px-3 text-xs text-neutral-400 hover:text-teal-300"><Plus className="h-3.5 w-3.5" /> Publicação</button>
      </div>
      {publicacoes.length === 0 ? (
        <EmptyState icone={Send} titulo="Nenhuma publicação registrada" descricao="Registre manualmente — publicação automática não faz parte desta rodada." />
      ) : (
        <div className="space-y-1.5">
          {publicacoes.map((p) => (
            <Card key={p.id} className="p-3">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <select defaultValue={p.plataforma} onChange={(e) => salvar(p.id, { plataforma: e.target.value as Publicacao["plataforma"] })} className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-300 outline-none focus:border-teal-500/40">
                  {["tiktok", "instagram", "youtube", "outro"].map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                </select>
                <input placeholder="URL" defaultValue={p.url ?? ""} onBlur={(e) => salvar(p.id, { url: e.target.value })} className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-200 outline-none focus:border-teal-500/40" />
                <input placeholder="título/legenda" defaultValue={p.titulo_legenda ?? ""} onBlur={(e) => salvar(p.id, { titulo_legenda: e.target.value })} className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-200 outline-none focus:border-teal-500/40" />
                <button onClick={() => remover(p.id)} className="flex h-[30px] items-center justify-center rounded text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AbaMetricas({ projeto, userId }: { projeto: ProducaoProjeto; userId: string }) {
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [metricasPorPub, setMetricasPorPub] = useState<Record<string, Metrica[]>>({});

  const carregar = useCallback(async () => {
    const todas = (await listarPublicacoes(userId)).filter((p) => p.projeto_id === projeto.id);
    setPublicacoes(todas);
    const mapa: Record<string, Metrica[]> = {};
    await Promise.all(todas.map(async (p) => { mapa[p.id] = await listarMetricas(p.id); }));
    setMetricasPorPub(mapa);
  }, [userId, projeto.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function registrar(publicacaoId: string, form: FormData) {
    await adicionarMetrica(userId, publicacaoId, {
      views: Number(form.get("views")) || null,
      likes: Number(form.get("likes")) || null,
      comments: Number(form.get("comments")) || null,
      shares: Number(form.get("shares")) || null,
    });
    carregar();
  }

  if (publicacoes.length === 0) return <EmptyState icone={BarChart3} titulo="Sem publicação registrada" descricao="Registre uma publicação na aba anterior pra acompanhar métricas aqui." />;

  return (
    <div className="space-y-3">
      {publicacoes.map((p) => (
        <Card key={p.id} className="p-3">
          <p className="mb-2 text-sm text-neutral-200">{p.plataforma} {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-teal-400">↗</a>}</p>
          <form action={(fd) => registrar(p.id, fd)} className="mb-2 grid grid-cols-4 gap-1.5">
            <input name="views" type="number" placeholder="views" className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-200 outline-none focus:border-teal-500/40" />
            <input name="likes" type="number" placeholder="likes" className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-200 outline-none focus:border-teal-500/40" />
            <input name="comments" type="number" placeholder="comments" className="min-h-[30px] rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] text-neutral-200 outline-none focus:border-teal-500/40" />
            <button type="submit" className="rounded border border-neutral-800 text-[11px] text-teal-300 hover:bg-teal-500/10">registrar snapshot</button>
          </form>
          {(metricasPorPub[p.id] ?? []).length > 0 && (
            <div className="space-y-1 text-[11px] text-neutral-500">
              {(metricasPorPub[p.id] ?? []).map((m) => (
                <p key={m.id}>{new Date(m.captured_at).toLocaleDateString("pt-BR")}: {m.views ?? "—"} views · {m.likes ?? "—"} likes · {m.comments ?? "—"} comentários</p>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
