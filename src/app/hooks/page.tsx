"use client";
import { Anchor } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "hooks",
  titulo: "Hooks",
  descricao: "Aberturas de vídeo de referência — o gancho dos primeiros segundos.",
  icone: Anchor,
  tituloPadrao: "Novo hook",
  filtroPrincipal: "tipo",
  camposDrawer: [
    { key: "transcricao_hook", label: "Transcrição do gancho", tipo: "textarea", placeholder: "O que foi dito/mostrado nos primeiros segundos" },
    {
      key: "tipo", label: "Tipo", tipo: "chips",
      opcoes: [
        { id: "pergunta", rotulo: "Pergunta" }, { id: "afirmacao_chocante", rotulo: "Afirmação chocante" },
        { id: "estatistica", rotulo: "Estatística" }, { id: "historia", rotulo: "História" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: curiosidade, polemica..." },
  ],
};

export default function HooksPage() {
  return <AssetLibrary config={config} />;
}
