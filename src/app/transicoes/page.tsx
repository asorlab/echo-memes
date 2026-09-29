"use client";
import { ArrowRightLeft } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";
import { extrairMetadadosArquivo } from "@/lib/metadados";

const config: AssetLibraryConfig = {
  tabela: "transicoes",
  tabelaUsos: "transicoes_usos",
  usosFk: "transicao_id",
  titulo: "Transições",
  descricao: "Efeitos de transição entre cortes — fade, whip pan, glitch, zoom.",
  icone: ArrowRightLeft,
  aceitaArquivo: "video/*",
  tituloPadrao: "Nova transição",
  extrairMetadados: extrairMetadadosArquivo,
  filtroPrincipal: "tipo",
  camposDrawer: [
    {
      key: "tipo", label: "Tipo", tipo: "select",
      opcoes: [
        { id: "corte_seco", rotulo: "Corte seco" }, { id: "fade", rotulo: "Fade" }, { id: "whip_pan", rotulo: "Whip pan" },
        { id: "zoom", rotulo: "Zoom" }, { id: "glitch", rotulo: "Glitch" }, { id: "luma", rotulo: "Luma" },
        { id: "slide", rotulo: "Slide" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: rapida, suave..." },
  ],
};

export default function TransicoesPage() {
  return <AssetLibrary config={config} />;
}
