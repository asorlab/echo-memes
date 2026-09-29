"use client";
import { Palette } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "paletas",
  titulo: "Paletas/Looks",
  descricao: "Paletas de cor e referências de look/clima visual.",
  icone: Palette,
  aceitaArquivo: "image/*",
  tituloPadrao: "Nova paleta",
  filtroPrincipal: "estilo",
  camposDrawer: [
    { key: "cores", label: "Cores (hex, separado por vírgula)", tipo: "tags", placeholder: "#0a0a0a, #2dd4bf, #F0997B" },
    {
      key: "estilo", label: "Clima", tipo: "chips",
      opcoes: [
        { id: "upbeat", rotulo: "Upbeat" }, { id: "calmo", rotulo: "Calmo" }, { id: "tenso", rotulo: "Tenso" },
        { id: "emotivo", rotulo: "Emotivo" }, { id: "epico", rotulo: "Épico" }, { id: "engracado", rotulo: "Engraçado" },
        { id: "misterioso", rotulo: "Misterioso" }, { id: "romantico", rotulo: "Romântico" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: quente, pastel..." },
  ],
};

export default function PaletasPage() {
  return <AssetLibrary config={config} />;
}
