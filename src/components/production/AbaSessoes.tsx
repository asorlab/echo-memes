"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays, Trash2, Clapperboard, ArrowLeft, Film, FolderInput } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EditableField from "@/components/ui/EditableField";
import { useMarca } from "@/components/marca/MarcaProvider";
import { CampoMarca, SeloMarca } from "@/components/marca/SeletorMarca";
import { faltaMigration } from "@/lib/lixeiraConfig";
import { marcaDoRegistro } from "@/lib/marca";
import { formatarTimecode } from "@/lib/timecode";
import { urlsAssinadas } from "@/lib/storage";
import { ROTULO_TIPO_SESSAO, TIPOS_SESSAO, ROTULO_STATUS_BRUTO } from "@/lib/production/rotulos";
import {
  listarSessoes, criarSessao, atualizarSessao, excluirSessao, criarProducaoProjeto, associarBrutoAoProjeto, moverBrutoParaSessao,
} from "@/lib/production/data";
import type { Bruto, Sessao } from "@/lib/production/types";

const formatarData = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function AbaSessoes({ userId, brutos, onAbrirBruto, onMudou }: {
  userId: string; brutos: Bruto[]; onAbrirBruto: (b: Bruto) => void; onMudou: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const { passa, campoNovo } = useMarca();
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semMigration, setSemMigration] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [capas, setCapas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      setSessoes(await listarSessoes(userId));
      setSemMigration(false);
    } catch (e) {
      setSemMigration(faltaMigration((e as { message?: string })?.message));
    }
    setCarregando(false);
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => { urlsAssinadas(brutos.map((b) => b.miniatura_url)).then(setCapas); }, [brutos]);

  const brutosPorSessao = useMemo(() => {
    const mapa: Record<string, Bruto[]> = {};
    for (const b of brutos) if (b.sessao_id) (mapa[b.sessao_id] ??= []).push(b);
    return mapa;
  }, [brutos]);
  const soltos = brutos.filter((b) => !b.sessao_id);
  const visiveis = sessoes.filter((s) => passa(marcaDoRegistro(s.marca_slug)));
  const aberta = sessoes.find((s) => s.id === abertaId) ?? null;

  async function nova() {
    try {
      const s = await criarSessao(userId, { nome: "Nova sessão", ...campoNovo() });
      setSessoes((l) => [s, ...l]);
      setAbertaId(s.id);
    } catch { /* aviso vermelho do banco */ }
  }
  async function salvar(patch: Partial<Sessao>) {
    if (!aberta) return;
    await atualizarSessao(aberta.id, patch);
    setSessoes((l) => l.map((s) => (s.id === aberta.id ? { ...s, ...patch } : s)));
  }
  async function excluir() {
    if (!aberta || !window.confirm("Mover esta sessão para a Lixeira? Os brutos continuam na Inbox.")) return;
    await excluirSessao(aberta.id);
    setAbertaId(null);
    toast("Sessão na Lixeira");
    carregar();
  }
  async function criarProducao(s: Sessao) {
    const lista = brutosPorSessao[s.id] ?? [];
    if (lista.length === 0) return;
    const p = await criarProducaoProjeto(userId, s.nome, s.marca_slug ? { marca_slug: s.marca_slug } : {});
    await Promise.all(lista.map((b) => associarBrutoAoProjeto(userId, p.id, b.id)));
    router.push(`/production/${p.id}`);
  }
  async function trazerBruto(b: Bruto) {
    if (!aberta) return;
    await moverBrutoParaSessao(b.id, aberta.id);
    onMudou();
  }

  if (carregando) return <p className="py-10 text-center text-sm text-neutral-500">Carregando...</p>;
  if (semMigration) return <EmptyState icone={CalendarDays} titulo="Sessões ainda não estão ligadas" descricao="Falta rodar a migration 0033 no Supabase. Os brutos continuam na Inbox." />;

  if (aberta) {
    const lista = brutosPorSessao[aberta.id] ?? [];
    const duracao = lista.reduce((t, b) => t + (b.duracao_seg ?? 0), 0);
    return (
      <div>
        <button onClick={() => setAbertaId(null)} className="mb-3 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"><ArrowLeft className="h-3.5 w-3.5" /> Sessões</button>
        <Card className="mb-4 space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <EditableField value={aberta.nome} onSave={(v) => salvar({ nome: v })} displayClassName="text-lg font-semibold text-neutral-100" />
            <button onClick={excluir} title="Mover para a Lixeira" aria-label="Mover sessão para a Lixeira" className="shrink-0 text-neutral-500 hover:text-[#F0997B]"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500">Data
              <input type="date" value={aberta.data} onChange={(e) => e.target.value && salvar({ data: e.target.value })} className="mt-1 block min-h-[32px] w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs normal-case text-neutral-200 outline-none focus:border-teal-500/40" />
            </label>
            <label className="text-[10px] uppercase tracking-wide text-neutral-500">Tipo
              <select value={aberta.tipo} onChange={(e) => salvar({ tipo: e.target.value as Sessao["tipo"] })} className="mt-1 block min-h-[32px] w-full rounded border border-neutral-800 bg-neutral-950 px-1.5 text-xs normal-case text-neutral-200 outline-none focus:border-teal-500/40">
                {TIPOS_SESSAO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_SESSAO[t]}</option>)}
              </select>
            </label>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">Plataforma
              <EditableField value={aberta.plataforma ?? ""} placeholder="Twitch, YouTube, TikTok..." onSave={(v) => salvar({ plataforma: v || null })} displayClassName="mt-1 text-xs normal-case text-neutral-200" />
            </div>
          </div>
          <CampoMarca valor={marcaDoRegistro(aberta.marca_slug)} onMudar={(m) => salvar({ marca_slug: m })} />
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Notas da gravação</p>
            <EditableField as="textarea" value={aberta.notas ?? ""} placeholder="O que aconteceu, momentos para lembrar..." onSave={(v) => salvar({ notas: v || null })} displayClassName="text-xs text-neutral-300" />
          </div>
          {aberta.pasta_local && <p className="text-[10px] text-neutral-500">Veio da pasta do PC: {aberta.pasta_local}</p>}
        </Card>

        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-400">{lista.length} bruto(s){duracao > 0 && ` · ${formatarTimecode(duracao * 1000)} no total`}</p>
          <button onClick={() => criarProducao(aberta)} disabled={lista.length === 0} className="flex min-h-[36px] items-center gap-1.5 rounded-md bg-teal-500 px-3 text-xs font-medium text-neutral-950 hover:opacity-90 disabled:opacity-40">
            <Clapperboard className="h-3.5 w-3.5" /> Criar produção com a sessão
          </button>
        </div>
        {lista.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 p-4 text-center text-xs text-neutral-500">Sem brutos. Ponha os vídeos numa subpasta com o nome da sessão dentro da pasta vigiada, ou traga um bruto solto abaixo.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lista.map((b) => <MiniBruto key={b.id} bruto={b} capa={b.miniatura_url ? capas[b.miniatura_url] : undefined} onAbrir={() => onAbrirBruto(b)} />)}
          </div>
        )}

        {soltos.length > 0 && (
          <details className="mt-4 rounded-md border border-neutral-800">
            <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200">Trazer bruto sem sessão ({soltos.length})</summary>
            <ul className="divide-y divide-neutral-900 border-t border-neutral-800">
              {soltos.map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-neutral-300">{b.nome}</span>
                  <button onClick={() => trazerBruto(b)} className="flex items-center gap-1 text-teal-300 hover:underline"><FolderInput className="h-3.5 w-3.5" /> Trazer</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Cada subpasta da pasta vigiada vira uma sessão. Vídeo solto entra na sessão do dia.</p>
        <button onClick={nova} className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-neutral-800 px-3 text-xs text-neutral-300 hover:text-teal-300"><Plus className="h-3.5 w-3.5" /> Sessão</button>
      </div>
      {visiveis.length === 0 ? (
        <EmptyState icone={CalendarDays} titulo={sessoes.length === 0 ? "Nenhuma sessão ainda" : "Nenhuma sessão nesta marca"} descricao={sessoes.length === 0 ? "Ligue o worker no PC e ponha os vídeos na pasta vigiada, ou crie uma sessão à mão." : "Troque a marca no menu para ver as outras."} />
      ) : (
        <div className="space-y-1.5">
          {visiveis.map((s) => {
            const lista = brutosPorSessao[s.id] ?? [];
            const capa = lista.find((b) => b.miniatura_url)?.miniatura_url;
            const preparando = lista.filter((b) => b.status === "processando").length;
            return (
              <button key={s.id} onClick={() => setAbertaId(s.id)} className="flex w-full items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-2 text-left hover:border-teal-500/30">
                {capa && capas[capa] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capas[capa]} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-neutral-900"><Film className="h-4 w-4 text-neutral-600" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm text-neutral-100">{s.nome}</p>
                    <SeloMarca valor={marcaDoRegistro(s.marca_slug)} />
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    {formatarData(s.data)} · {ROTULO_TIPO_SESSAO[s.tipo]}{s.plataforma && ` · ${s.plataforma}`} · {lista.length} bruto(s){preparando > 0 && ` · ${preparando} preparando`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniBruto({ bruto, capa, onAbrir }: { bruto: Bruto; capa?: string; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-2 text-left hover:border-teal-500/30">
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capa} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-neutral-900"><Film className="h-4 w-4 text-neutral-600" /></div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-neutral-200">{bruto.nome}</p>
        <p className="text-[10px] text-neutral-500">
          {bruto.duracao_seg ? formatarTimecode(bruto.duracao_seg * 1000) : "duração ainda não lida"} · {ROTULO_STATUS_BRUTO[bruto.status]}
        </p>
      </div>
    </button>
  );
}
