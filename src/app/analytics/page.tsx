"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useUser } from "@/lib/useUser";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { listarProducaoProjetos, listarPublicacoes, listarMetricas } from "@/lib/production/data";
import type { ProducaoProjeto, Publicacao, Metrica } from "@/lib/production/types";

interface LinhaProjeto {
  projeto: ProducaoProjeto;
  publicacoes: { publicacao: Publicacao; ultimaMetrica: Metrica | null }[];
}

export default function AnalyticsPage() {
  const { user } = useUser();
  const [linhas, setLinhas] = useState<LinhaProjeto[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    const [projetos, publicacoes] = await Promise.all([listarProducaoProjetos(user.id), listarPublicacoes(user.id)]);
    const porProjeto = new Map<string, Publicacao[]>();
    for (const p of publicacoes) {
      if (!porProjeto.has(p.projeto_id)) porProjeto.set(p.projeto_id, []);
      porProjeto.get(p.projeto_id)!.push(p);
    }
    const resultado: LinhaProjeto[] = [];
    for (const projeto of projetos) {
      const pubs = porProjeto.get(projeto.id);
      if (!pubs || pubs.length === 0) continue;
      const comMetricas = await Promise.all(pubs.map(async (publicacao) => {
        const metricas = await listarMetricas(publicacao.id);
        return { publicacao, ultimaMetrica: metricas[0] ?? null };
      }));
      resultado.push({ projeto, publicacoes: comMetricas });
    }
    setLinhas(resultado);
    setCarregando(false);
  }, [user]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div>
      <PageHeader titulo="Analytics" descricao="Publicações e métricas registradas manualmente, sem importação automática" />

      {carregando ? (
        <p className="py-10 text-center text-sm text-neutral-600">Carregando...</p>
      ) : linhas.length === 0 ? (
        <EmptyState icone={BarChart3} titulo="Nenhuma publicação registrada ainda" descricao="Registre publicações na aba Publicação de um projeto em Production." />
      ) : (
        <div className="space-y-4">
          {linhas.map(({ projeto, publicacoes }) => (
            <Card key={projeto.id} className="p-4">
              <p className="mb-3 text-sm font-medium text-neutral-100">{projeto.titulo}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-neutral-600">
                      <th className="pb-1.5 pr-3">Plataforma</th>
                      <th className="pb-1.5 pr-3">Views</th>
                      <th className="pb-1.5 pr-3">Likes</th>
                      <th className="pb-1.5 pr-3">Comments</th>
                      <th className="pb-1.5 pr-3">Shares</th>
                      <th className="pb-1.5">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicacoes.map(({ publicacao, ultimaMetrica }) => (
                      <tr key={publicacao.id} className="border-t border-neutral-900">
                        <td className="py-1.5 pr-3 text-neutral-300">{publicacao.plataforma}</td>
                        <td className="py-1.5 pr-3 text-neutral-400">{ultimaMetrica?.views ?? "-"}</td>
                        <td className="py-1.5 pr-3 text-neutral-400">{ultimaMetrica?.likes ?? "-"}</td>
                        <td className="py-1.5 pr-3 text-neutral-400">{ultimaMetrica?.comments ?? "-"}</td>
                        <td className="py-1.5 pr-3 text-neutral-400">{ultimaMetrica?.shares ?? "-"}</td>
                        <td className="py-1.5 text-neutral-500">{ultimaMetrica ? new Date(ultimaMetrica.captured_at).toLocaleDateString("pt-BR") : "sem dados"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
          <p className="text-[11px] text-neutral-600">Nesta amostra: nenhuma conclusão de causa aqui, só os números registrados. Sem importação automática de métricas nesta rodada.</p>
        </div>
      )}
    </div>
  );
}
