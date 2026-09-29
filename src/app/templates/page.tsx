"use client";
import { LayoutTemplate } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "templates",
  tabelaUsos: "templates_usos",
  usosFk: "template_id",
  titulo: "Templates",
  descricao: "Templates de edição prontos — geralmente um link (CapCut, Premiere...).",
  icone: LayoutTemplate,
  tituloPadrao: "Novo template",
  filtroPrincipal: "app_compativel",
  camposDrawer: [
    {
      key: "app_compativel", label: "App compatível", tipo: "select",
      opcoes: [
        { id: "capcut", rotulo: "CapCut" }, { id: "premiere", rotulo: "Premiere" },
        { id: "davinci", rotulo: "DaVinci Resolve" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      key: "orientacao", label: "Orientação", tipo: "chips",
      opcoes: [{ id: "vertical", rotulo: "Vertical" }, { id: "horizontal", rotulo: "Horizontal" }],
    },
    { key: "ideia_uso", label: "Ideia de uso", tipo: "textarea", placeholder: "Ex.: usar pra abertura de vlog rápido" },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: rapido, storytelling..." },
  ],
};

export default function TemplatesPage() {
  return <AssetLibrary config={config} />;
}
