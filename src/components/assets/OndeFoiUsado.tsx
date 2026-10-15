"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Dna } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Vinculo { chave: string; tipo: "projeto" | "dna"; nome: string; detalhe: string; href: string }

const PAPEL: Record<string, string> = { referencia: "referência", planejado: "planejado", usado: "usado" };

// Projetos (projeto_itens) e Editing DNA (producao_dna_referencias) que apontam para o item.
// Le o vinculo ao vivo, nada e copiado. Itens na Lixeira ficam de fora.
async function buscarVinculos(tabela: string, id: string): Promise<Vinculo[]> {
  const sb = supabaseBrowser();
  const [proj, dna] = await Promise.all([
    sb.from("projeto_itens").select("id, papel, projeto_id, projetos(nome, excluido_em)").eq("tabela_origem", tabela).eq("item_id", id),
    sb.from("producao_dna_referencias").select("id, dna_id, producao_editing_dna(nome, excluido_em)").eq("tabela_asset", tabela).eq("asset_id", id),
  ]);
  const lista: Vinculo[] = [];
  for (const r of (proj.data ?? []) as unknown as { id: string; papel: string; projeto_id: string; projetos: { nome: string; excluido_em: string | null } | null }[]) {
    if (r.projetos && !r.projetos.excluido_em) lista.push({ chave: `p:${r.id}`, tipo: "projeto", nome: r.projetos.nome, detalhe: PAPEL[r.papel] ?? r.papel, href: `/projetos/${r.projeto_id}` });
  }
  for (const r of (dna.data ?? []) as unknown as { id: string; dna_id: string; producao_editing_dna: { nome: string; excluido_em?: string | null } | null }[]) {
    if (r.producao_editing_dna && !r.producao_editing_dna.excluido_em) lista.push({ chave: `d:${r.id}`, tipo: "dna", nome: r.producao_editing_dna.nome, detalhe: "referência do DNA", href: `/editing-dna?abrir=${r.dna_id}` });
  }
  return lista;
}

export default function OndeFoiUsado({ tabela, id }: { tabela: string; id: string }) {
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  useEffect(() => {
    let vivo = true;
    setVinculos(null);
    buscarVinculos(tabela, id).then((v) => { if (vivo) setVinculos(v); }).catch(() => { if (vivo) setVinculos([]); });
    return () => { vivo = false; };
  }, [tabela, id]);

  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Onde foi usado</p>
      {vinculos === null ? (
        <p className="text-[11px] text-neutral-500">Carregando...</p>
      ) : vinculos.length === 0 ? (
        <p className="text-[11px] text-neutral-500">Em nenhum projeto nem Editing DNA.</p>
      ) : (
        <ul className="space-y-1">
          {vinculos.map((v) => {
            const Icone = v.tipo === "projeto" ? FolderKanban : Dna;
            return (
              <li key={v.chave}>
                <Link href={v.href} className="flex items-center gap-2 rounded-md border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-300 hover:border-teal-500/30 hover:text-teal-200">
                  <Icone className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                  <span className="shrink-0 text-[10px] text-neutral-500">{v.detalhe}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
