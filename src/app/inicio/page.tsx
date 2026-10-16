"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck, Clapperboard, Film, Send, Lightbulb, Upload, Search, ArrowRight, Cpu } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { listarBrutos, listarProducaoProjetos, listarPublicacoes, listarJobsRecentes, listarWorkers } from "@/lib/production/data";
import { estadoDoWorker } from "@/lib/production/worker";
import { ROTULO_STATUS_CLIP, ROTULO_STATUS_PROJETO, ROTULO_PLATAFORMA } from "@/lib/production/rotulos";
import type { Bruto, Clip, ProducaoProjeto, Publicacao } from "@/lib/production/types";
import { useMarca } from "@/components/marca/MarcaProvider";
import { SeloMarca } from "@/components/marca/SeletorMarca";
import { EVENTO_ABRIR_BUSCA } from "@/components/BuscaGlobal";
import { marcaDoRegistro, nomeMarca } from "@/lib/marca";

type ClipComProjeto = Clip & { producao_projetos: ProducaoProjeto | null };

function Bloco({ icone: Icone, titulo, href, rotuloLink, vazio, children, quantidade }: {
  icone: typeof Film; titulo: string; href: string; rotuloLink: string; vazio: string; children: ReactNode; quantidade: number;
}) {
  return (
    <section className="border-t border-neutral-800 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Icone className="h-3.5 w-3.5 text-teal-400" />
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-neutral-300">{titulo}</h2>
        <Link href={href} className="ml-auto flex items-center gap-1 text-[11px] text-neutral-500 hover:text-teal-300">{rotuloLink} <ArrowRight className="h-3 w-3" /></Link>
      </div>
      {quantidade === 0 ? <p className="text-xs text-neutral-500">{vazio}</p> : <ul className="divide-y divide-neutral-900">{children}</ul>}
    </section>
  );
}

function Linha({ href, titulo, detalhe, extra }: { href: string; titulo: string; detalhe: string; extra?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 py-2 text-sm hover:text-teal-200">
        <span className="min-w-0 flex-1 truncate text-neutral-200">{titulo}</span>
        {extra}
        <span className="shrink-0 text-[11px] text-neutral-500">{detalhe}</span>
      </Link>
    </li>
  );
}

export default function InicioPage() {
  const { user } = useUser();
  const { marca, passa } = useMarca();
  const [carregando, setCarregando] = useState(true);
  const [revisar, setRevisar] = useState<ClipComProjeto[]>([]);
  const [producoes, setProducoes] = useState<ProducaoProjeto[]>([]);
  const [brutos, setBrutos] = useState<Bruto[]>([]);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [fila, setFila] = useState<{ esperando: number; falhou: number; vistoEm: string | null } | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    // Fila do worker (0033): some sem aviso se a migration ainda nao rodou.
    Promise.all([listarJobsRecentes(user.id, 100), listarWorkers(user.id)])
      .then(([j, w]) => setFila({
        esperando: j.filter((x) => x.status === "queued" || x.status === "processing").length,
        falhou: j.filter((x) => x.status === "failed").length,
        vistoEm: w[0]?.visto_em ?? null,
      }))
      .catch(() => setFila(null));
    const [clips, projetos, b, pubs] = await Promise.all([
      supabaseBrowser().from("producao_clips").select("*, producao_projetos(*)").eq("user_id", user.id)
        .in("status", ["queued", "review"]).is("excluido_em", null).order("created_at", { ascending: false }).limit(30),
      listarProducaoProjetos(user.id).catch(() => []),
      listarBrutos(user.id).catch(() => []),
      listarPublicacoes(user.id).catch(() => []),
    ]);
    setRevisar(((clips.data ?? []) as ClipComProjeto[]).filter((c) => c.producao_projetos && !c.producao_projetos.excluido_em));
    setProducoes(projetos);
    setBrutos(b.filter((x) => x.status === "novo"));
    setPublicacoes(pubs.slice(0, 20));
    setCarregando(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const marcaDoProjeto = (p: ProducaoProjeto | null | undefined) => marcaDoRegistro(p?.marca_slug);
  const tituloDoProjeto = new Map(producoes.map((p) => [p.id, p]));
  const revisarVisiveis = revisar.filter((c) => passa(marcaDoProjeto(c.producao_projetos)));
  const emAndamento = producoes.filter((p) => !["publicado", "exportado"].includes(p.status) && passa(marcaDoProjeto(p))).slice(0, 8);
  const publicadasVisiveis = publicacoes.filter((p) => passa(marcaDoProjeto(tituloDoProjeto.get(p.projeto_id)))).slice(0, 5);

  return (
    <div className="max-w-3xl">
      <header className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Visão geral · {marca === "todas" ? "todas as marcas" : nomeMarca(marca)}</p>
        <h1 className="text-xl font-semibold text-neutral-100">O que pede você agora</h1>
      </header>

      {fila && (fila.falhou > 0 || (fila.esperando > 0 && !estadoDoWorker(fila.vistoEm, Date.now()).ligado)) && (
        <Link href="/sistema/jobs" className="mb-4 flex items-center gap-2 border-l-2 border-[#F0997B] bg-[#F0997B0D] px-3 py-2 text-xs text-[#F0997B] hover:bg-[#F0997B1A]">
          <Cpu className="h-3.5 w-3.5 shrink-0" />
          {fila.falhou > 0 && `${fila.falhou} job(s) falharam. `}
          {fila.esperando > 0 && !estadoDoWorker(fila.vistoEm, Date.now()).ligado && `${fila.esperando} esperando o PC: ${estadoDoWorker(fila.vistoEm, Date.now()).texto.toLowerCase()}.`}
          <ArrowRight className="ml-auto h-3 w-3" />
        </Link>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/inspiracoes" className="flex min-h-[40px] items-center gap-2 rounded-md border border-neutral-800 px-3 text-xs text-neutral-300 hover:border-teal-500/30 hover:text-teal-200"><Lightbulb className="h-3.5 w-3.5" /> Guardar referência</Link>
        <Link href="/production?tab=inbox" className="flex min-h-[40px] items-center gap-2 rounded-md border border-neutral-800 px-3 text-xs text-neutral-300 hover:border-teal-500/30 hover:text-teal-200"><Upload className="h-3.5 w-3.5" /> Adicionar bruto</Link>
        <button onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_BUSCA))} className="flex min-h-[40px] items-center gap-2 rounded-md border border-neutral-800 px-3 text-xs text-neutral-300 hover:border-teal-500/30 hover:text-teal-200"><Search className="h-3.5 w-3.5" /> Buscar em tudo</button>
      </div>

      {carregando ? (
        <p className="py-10 text-sm text-neutral-500">Carregando...</p>
      ) : (
        <div className="space-y-6">
          <Bloco icone={ClipboardCheck} titulo="Cortes para revisar" href="/production?tab=projetos" rotuloLink="Produções" vazio="Nenhum corte esperando revisão." quantidade={revisarVisiveis.length}>
            {revisarVisiveis.map((c) => (
              <Linha key={c.id} href={`/production/${c.projeto_id}`} titulo={c.nome} detalhe={`${c.producao_projetos?.titulo ?? ""} · ${ROTULO_STATUS_CLIP[c.status]}`}
                extra={<SeloMarca valor={marcaDoProjeto(c.producao_projetos)} />} />
            ))}
          </Bloco>

          <Bloco icone={Clapperboard} titulo="Produções em andamento" href="/production?tab=projetos" rotuloLink="Todas" vazio="Nenhuma produção em andamento." quantidade={emAndamento.length}>
            {emAndamento.map((p) => (
              <Linha key={p.id} href={`/production/${p.id}`} titulo={p.titulo} detalhe={ROTULO_STATUS_PROJETO[p.status]} extra={<SeloMarca valor={marcaDoProjeto(p)} />} />
            ))}
          </Bloco>

          <Bloco icone={Film} titulo="Brutos sem produção" href="/production?tab=inbox" rotuloLink="Inbox" vazio="Todo bruto já está numa produção." quantidade={brutos.length}>
            {brutos.slice(0, 6).map((b) => (
              <Linha key={b.id} href="/production?tab=inbox" titulo={b.nome} detalhe={new Date(b.created_at).toLocaleDateString("pt-BR")} />
            ))}
          </Bloco>

          <Bloco icone={Send} titulo="Publicadas por último" href="/analytics" rotuloLink="Analytics" vazio="Nenhuma publicação registrada." quantidade={publicadasVisiveis.length}>
            {publicadasVisiveis.map((p) => (
              <Linha key={p.id} href={`/production/${p.projeto_id}`} titulo={tituloDoProjeto.get(p.projeto_id)?.titulo ?? "Produção"}
                detalhe={`${ROTULO_PLATAFORMA[p.plataforma] ?? p.plataforma}${p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString("pt-BR")}` : ""}`} />
            ))}
          </Bloco>
        </div>
      )}
    </div>
  );
}
