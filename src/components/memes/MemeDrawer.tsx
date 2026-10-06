"use client";

import { useRef, useState } from "react";
import {
  X, Trash2, Download, ExternalLink, Star, Clapperboard, Scissors, History,
  ShieldAlert, Gauge, Lightbulb, Plus, Volume2, VolumeX, Mic, MicOff,
} from "lucide-react";
import EditableField from "@/components/ui/EditableField";
import type {
  Categoria, Emocao, Momento, Formato, FormaUso, AudioPref, Intensidade, Status, Risco, Meme, MemeUso,
} from "@/lib/types";
import { FORMATOS_CONTEUDO } from "@/lib/formatos";

const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: "iveasor", rotulo: "IveAsor" }, { id: "asor", rotulo: "ASOR.lab" },
  { id: "aivil", rotulo: "AIVIL" }, { id: "geral", rotulo: "Geral" },
];
const EMOCOES: { id: Emocao; rotulo: string }[] = [
  { id: "vergonha", rotulo: "Vergonha" }, { id: "choque", rotulo: "Choque" }, { id: "deboche", rotulo: "Deboche" },
  { id: "deu_ruim", rotulo: "Deu ruim" }, { id: "vitoria", rotulo: "Vitória" }, { id: "cansaco", rotulo: "Cansaço" }, { id: "ironia", rotulo: "Ironia" },
];
const MOMENTOS: { id: Momento; rotulo: string }[] = [
  { id: "gancho", rotulo: "Gancho" }, { id: "transicao", rotulo: "Transição" }, { id: "punchline", rotulo: "Punchline" }, { id: "fecho", rotulo: "Fecho" },
];
const FORMATOS = FORMATOS_CONTEUDO;
const FORMAS_USO: { id: FormaUso; rotulo: string }[] = [
  { id: "corte_seco", rotulo: "Corte seco" }, { id: "overlay", rotulo: "Overlay" }, { id: "reaction", rotulo: "Reaction" },
  { id: "green_screen", rotulo: "Green screen" }, { id: "audio", rotulo: "Áudio" }, { id: "insert", rotulo: "Insert" },
];
const AUDIO_PREFS: { id: AudioPref; rotulo: string }[] = [
  { id: "original", rotulo: "Áudio original" }, { id: "mudo", rotulo: "Mutar" }, { id: "so_fala", rotulo: "Só a fala" },
];
const INTENSIDADES: { id: Intensidade; rotulo: string }[] = [
  { id: "sutil", rotulo: "Sutil" }, { id: "media", rotulo: "Média" }, { id: "caos", rotulo: "Caos" },
];
const STATUS: { id: Status; rotulo: string }[] = [
  { id: "novo", rotulo: "Novo" }, { id: "classificado", rotulo: "Classificado" }, { id: "usado", rotulo: "Usado" },
];
const RISCOS: { id: Risco; rotulo: string; cor: string }[] = [
  { id: "baixo", rotulo: "Baixo", cor: "text-teal-300" }, { id: "medio", rotulo: "Médio", cor: "text-amber-300" }, { id: "alto", rotulo: "Alto", cor: "text-[#F0997B]" },
];

function Secao({ icone: Icone, titulo, cor, children }: { icone: typeof Star; titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <p className={`mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${cor}`}>
        <Icone className="h-3.5 w-3.5" /> {titulo}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ChipToggle<T extends string>({ opcoes, selecionados, onToggle }: { opcoes: { id: T; rotulo: string }[]; selecionados: T[]; onToggle: (id: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          className={`rounded-full border px-2.5 py-1 text-[11px] ${selecionados.includes(o.id) ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function ehVideo(url: string): boolean {
  const semQuery = url.split("?")[0].toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v"].some((ext) => semQuery.endsWith(ext));
}

interface MemeDrawerProps {
  meme: Meme;
  arquivoUrlResolvido: string | null;
  usos: MemeUso[];
  onFechar: () => void;
  onAtualizar: (patch: Partial<{
    titulo: string; explicacao: string; tags: string[]; criador: string | null; categoria: Categoria | null;
    emocao: Emocao | null; momento: Momento | null; formatos: Formato[]; forma_uso: FormaUso[];
    audio_pref: AudioPref | null; ideia_uso: string | null; intensidade: Intensidade | null;
    favorito: boolean; status: Status; risco: Risco | null; tem_audio: boolean | null; tem_fala: boolean | null;
    corte_inicio: number | null; corte_fim: number | null;
  }>) => void;
  onTrocarArquivo: (arquivo: File) => void;
  onExcluir: () => void;
  onBaixar: () => void;
  onRegistrarUso: (contexto: string) => void;
  onExcluirUso: (id: string) => void;
}

export default function MemeDrawer({ meme, arquivoUrlResolvido, usos, onFechar, onAtualizar, onTrocarArquivo, onExcluir, onBaixar, onRegistrarUso, onExcluirUso }: MemeDrawerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [novoUso, setNovoUso] = useState("");

  function marcarCorte(ponta: "inicio" | "fim") {
    const t = videoRef.current ? Math.round(videoRef.current.currentTime * 10) / 10 : null;
    if (t == null) return;
    onAtualizar(ponta === "inicio" ? { corte_inicio: t } : { corte_fim: t });
  }

  function alternarLista<T extends string>(lista: T[], id: T): T[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
  }

  function registrarUso() {
    const contexto = novoUso.trim();
    if (!contexto) return;
    onRegistrarUso(contexto);
    setNovoUso("");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAtualizar({ favorito: !meme.favorito })}
              title={meme.favorito ? "Remover dos favoritos" : "Favoritar"}
              className={meme.favorito ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"}
            >
              <Star className="h-4 w-4" fill={meme.favorito ? "currentColor" : "none"} />
            </button>
            <select
              value={meme.status}
              onChange={(e) => onAtualizar({ status: e.target.value as Status })}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 outline-none"
            >
              {STATUS.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </select>
          </div>
          <button onClick={onFechar} className="text-neutral-500 hover:text-neutral-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {meme.imagemUrl && arquivoUrlResolvido && (
            <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
              {ehVideo(meme.imagemUrl) ? (
                <video ref={videoRef} src={arquivoUrlResolvido} controls playsInline className="max-h-[280px] w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={arquivoUrlResolvido} alt="" className="max-h-[280px] w-full object-contain" />
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={onBaixar} className="flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:opacity-90">
              <Download className="h-3.5 w-3.5" /> Baixar pra timeline
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200">
              Substituir arquivo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onTrocarArquivo(f); e.target.value = ""; }} />
            {meme.linkOrigem && (
              <a href={meme.linkOrigem} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200">
                <ExternalLink className="h-3.5 w-3.5" /> Origem
              </a>
            )}
          </div>

          <EditableField value={meme.titulo} onSave={(v) => onAtualizar({ titulo: v })} displayClassName="text-lg font-semibold text-neutral-100" />

          <Secao icone={Clapperboard} titulo="Classificação" cor="text-sky-300">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Emoção / Reação</p>
              <select
                value={meme.emocao ?? ""}
                onChange={(e) => onAtualizar({ emocao: (e.target.value || null) as Emocao | null })}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-teal-500/40"
              >
                <option value="">Sem emoção definida</option>
                {EMOCOES.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Momento de edição</p>
              <select
                value={meme.momento ?? ""}
                onChange={(e) => onAtualizar({ momento: (e.target.value || null) as Momento | null })}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-teal-500/40"
              >
                <option value="">Sem momento definido</option>
                {MOMENTOS.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Formatos compatíveis</p>
              <ChipToggle opcoes={FORMATOS} selecionados={meme.formatos} onToggle={(id) => onAtualizar({ formatos: alternarLista(meme.formatos, id) })} />
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Intensidade</p>
              <div className="flex gap-1.5">
                {INTENSIDADES.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => onAtualizar({ intensidade: i.id === meme.intensidade ? null : i.id })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${meme.intensidade === i.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
                  >
                    {i.rotulo}
                  </button>
                ))}
              </div>
            </div>
          </Secao>

          <Secao icone={Scissors} titulo="Uso na edição" cor="text-teal-300">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Forma de uso</p>
              <ChipToggle opcoes={FORMAS_USO} selecionados={meme.formaUso} onToggle={(id) => onAtualizar({ forma_uso: alternarLista(meme.formaUso, id) })} />
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Áudio</p>
              <div className="flex gap-1.5">
                {AUDIO_PREFS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onAtualizar({ audio_pref: a.id === meme.audioPref ? null : a.id })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${meme.audioPref === a.id ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onAtualizar({ tem_audio: meme.temAudio ? false : true })}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${meme.temAudio ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
              >
                {meme.temAudio ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />} {meme.temAudio ? "Tem áudio" : "Sem áudio"}
              </button>
              <button
                onClick={() => onAtualizar({ tem_fala: meme.temFala ? false : true })}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${meme.temFala ? "border-teal-500/50 bg-teal-500/10 text-teal-300" : "border-neutral-800 text-neutral-500"}`}
              >
                {meme.temFala ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />} {meme.temFala ? "Tem fala" : "Sem fala"}
              </button>
            </div>
            {meme.imagemUrl && ehVideo(meme.imagemUrl) && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Ponto de corte (in/out)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => marcarCorte("inicio")} className="rounded-md border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-300 hover:border-teal-500/40">
                    Marcar início {meme.corteInicio != null && `(${meme.corteInicio}s)`}
                  </button>
                  <button onClick={() => marcarCorte("fim")} className="rounded-md border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-300 hover:border-teal-500/40">
                    Marcar fim {meme.corteFim != null && `(${meme.corteFim}s)`}
                  </button>
                  <span className="text-[10px] text-neutral-600">pausa o vídeo no ponto certo e clica</span>
                </div>
              </div>
            )}
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-600"><Lightbulb className="h-3 w-3" /> Ideia de uso</p>
              <EditableField
                as="textarea"
                value={meme.ideiaUso ?? ""}
                placeholder='Ex.: "usar depois de mostrar o preço de algo"'
                onSave={(v) => onAtualizar({ ideia_uso: v || null })}
                displayClassName="text-xs leading-relaxed text-neutral-300"
              />
            </div>
          </Secao>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#F0997B]">
              <ShieldAlert className="h-3.5 w-3.5" /> Risco de uso
            </p>
            <div className="flex gap-1.5">
              {RISCOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onAtualizar({ risco: r.id === meme.risco ? null : r.id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${meme.risco === r.id ? `border-current bg-current/10 ${r.cor}` : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
                >
                  {r.rotulo}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-neutral-600">Trecho de filme, série ou música = risco alto. Memes curtos funcionam como pontuação, não como parte central do vídeo.</p>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Por que esse meme pega</p>
            <EditableField as="textarea" value={meme.explicacao} placeholder="Por que esse meme pega…" onSave={(v) => onAtualizar({ explicacao: v })} displayClassName="text-xs leading-relaxed text-neutral-300" />
          </div>

          <Secao icone={History} titulo="Registro de uso" cor="text-fuchsia-300">
            {usos.length === 0 ? (
              <p className="text-[11px] text-neutral-600">Nunca usado ainda.</p>
            ) : (
              <div className="space-y-1">
                {usos.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
                    <span className="text-xs text-neutral-300">{u.contexto} · {new Date(u.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    <button onClick={() => onExcluirUso(u.id)} className="text-neutral-600 hover:text-[#F0997B]"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <input
                value={novoUso}
                onChange={(e) => setNovoUso(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") registrarUso(); }}
                placeholder="Ex.: Vlog, Gaming..."
                className="min-h-[32px] flex-1 rounded-md border border-dashed border-neutral-700 bg-transparent px-2 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-teal-500/40"
              />
              <button onClick={registrarUso} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-teal-400">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </Secao>

          <details className="group rounded-lg border border-neutral-800">
            <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-neutral-400 hover:text-neutral-200">Mais detalhes (origem, tags, categoria)</summary>
            <div className="space-y-3 border-t border-neutral-800 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Categoria (legado)</p>
                  <select
                    value={meme.categoria ?? ""}
                    onChange={(e) => onAtualizar({ categoria: (e.target.value || null) as Categoria | null })}
                    className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-300 outline-none"
                  >
                    <option value="">Sem categoria</option>
                    {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Quem postou</p>
                  <EditableField value={meme.criador ?? ""} placeholder="@quem postou" onSave={(v) => onAtualizar({ criador: v || null })} displayClassName="text-xs text-neutral-300" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Tags livres</p>
                <EditableField value={meme.tags.join(", ")} placeholder="tags: anime, bbb, copa" onSave={(v) => onAtualizar({ tags: v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} displayClassName="text-xs text-teal-500/80" />
              </div>
            </div>
          </details>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
          <button onClick={() => { if (window.confirm("Excluir este meme?")) onExcluir(); }} className="flex items-center gap-1.5 text-xs text-[#F0997B] hover:opacity-80">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
          <button onClick={onFechar} className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-teal-400">Fechar</button>
        </div>
      </div>
    </div>
  );
}
