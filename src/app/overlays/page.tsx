"use client";
import { Layers } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";
import { extrairMetadadosArquivo } from "@/lib/metadados";

const config: AssetLibraryConfig = {
  tabela: "overlays",
  tabelaUsos: "overlays_usos",
  usosFk: "overlay_id",
  titulo: "Overlays",
  descricao: "Elementos visuais pra sobrepor no vídeo — chuva, grão, glitch, luz.",
  icone: Layers,
  aceitaArquivo: "image/*,video/*",
  tituloPadrao: "Novo overlay",
  extrairMetadados: extrairMetadadosArquivo,
  filtroPrincipal: "tipo",
  camposDrawer: [
    {
      key: "tipo", label: "Tipo", tipo: "select",
      opcoes: [
        { id: "chuva", rotulo: "Chuva" }, { id: "grao", rotulo: "Grão" }, { id: "glitch", rotulo: "Glitch" },
        { id: "luz", rotulo: "Luz" }, { id: "poeira", rotulo: "Poeira" }, { id: "fumaca", rotulo: "Fumaça" },
        { id: "vhs", rotulo: "VHS" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "transparente", label: "Tem transparência (alpha)", tipo: "boolean" },
    {
      key: "momento", label: "Momento de edição", tipo: "chips",
      opcoes: [
        { id: "gancho", rotulo: "Gancho" }, { id: "transicao", rotulo: "Transição" },
        { id: "punchline", rotulo: "Punchline" }, { id: "fecho", rotulo: "Fecho" },
      ],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: escuro, urbano..." },
  ],
};

export default function OverlaysPage() {
  return <AssetLibrary config={config} />;
}
