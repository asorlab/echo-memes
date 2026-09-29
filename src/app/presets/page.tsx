"use client";
import { SlidersHorizontal } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "presets",
  tabelaUsos: "presets_usos",
  usosFk: "preset_id",
  titulo: "Presets",
  descricao: "Presets de cor e edição — LUTs, ajustes salvos por app.",
  icone: SlidersHorizontal,
  aceitaArquivo: "*/*",
  tituloPadrao: "Novo preset",
  filtroPrincipal: "estilo",
  camposDrawer: [
    {
      key: "app_compativel", label: "App compatível", tipo: "select",
      opcoes: [
        { id: "capcut", rotulo: "CapCut" }, { id: "premiere", rotulo: "Premiere" },
        { id: "davinci", rotulo: "DaVinci Resolve" }, { id: "lut_generico", rotulo: "LUT genérico" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      key: "estilo", label: "Estilo", tipo: "chips",
      opcoes: [
        { id: "cinematic", rotulo: "Cinematic" }, { id: "vibrante", rotulo: "Vibrante" },
        { id: "preto_e_branco", rotulo: "Preto e branco" }, { id: "vintage", rotulo: "Vintage" }, { id: "cru", rotulo: "Cru" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: quente, frio..." },
  ],
};

export default function PresetsPage() {
  return <AssetLibrary config={config} />;
}
