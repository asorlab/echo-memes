"use client";
import { Camera } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "shots",
  titulo: "Shots",
  descricao: "Enquadramentos de referência — pra lembrar de tentar de novo.",
  icone: Camera,
  aceitaArquivo: "image/*",
  tituloPadrao: "Novo shot",
  filtroPrincipal: "tipo_shot",
  camposDrawer: [
    {
      key: "tipo_shot", label: "Tipo de shot", tipo: "select",
      opcoes: [
        { id: "close_up", rotulo: "Close-up" }, { id: "plano_medio", rotulo: "Plano médio" }, { id: "plano_geral", rotulo: "Plano geral" },
        { id: "over_the_shoulder", rotulo: "Over the shoulder" }, { id: "pov", rotulo: "POV" }, { id: "drone", rotulo: "Drone" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: natural, estudio..." },
  ],
};

export default function ShotsPage() {
  return <AssetLibrary config={config} />;
}
