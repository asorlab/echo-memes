"use client";
import { Type } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "fontes",
  titulo: "Fontes",
  descricao: "Pra título, legenda ou corpo de texto.",
  icone: Type,
  aceitaArquivo: "*/*",
  tituloPadrao: "Nova fonte",
  filtroPrincipal: "estilo",
  camposDrawer: [
    {
      key: "estilo", label: "Estilo", tipo: "chips",
      opcoes: [
        { id: "serifada", rotulo: "Serifada" }, { id: "sem_serifa", rotulo: "Sem serifa" },
        { id: "script", rotulo: "Script" }, { id: "display", rotulo: "Display" }, { id: "monoespacada", rotulo: "Monoespaçada" },
      ],
    },
    {
      key: "uso_ideal", label: "Uso ideal", tipo: "chips",
      opcoes: [{ id: "titulo", rotulo: "Título" }, { id: "legenda", rotulo: "Legenda" }, { id: "corpo_texto", rotulo: "Corpo de texto" }],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: bold, elegante..." },
  ],
};

export default function FontesPage() {
  return <AssetLibrary config={config} />;
}
