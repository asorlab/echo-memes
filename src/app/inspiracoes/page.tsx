"use client";
import { Lightbulb } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "inspiracoes",
  titulo: "Inspirações",
  descricao: "Qualquer coisa que te inspirou — vídeo, imagem, texto, conta.",
  icone: Lightbulb,
  aceitaArquivo: "image/*,video/*",
  tituloPadrao: "Nova inspiração",
  filtroPrincipal: "categoria",
  camposDrawer: [
    {
      key: "categoria", label: "Categoria", tipo: "select",
      opcoes: [
        { id: "video", rotulo: "Vídeo" }, { id: "imagem", rotulo: "Imagem" }, { id: "texto", rotulo: "Texto" },
        { id: "conta_perfil", rotulo: "Conta/perfil" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    { key: "nota", label: "Por que inspira", tipo: "textarea", placeholder: "O que chamou atenção" },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: estetica, roteiro..." },
  ],
};

export default function InspiracoesPage() {
  return <AssetLibrary config={config} />;
}
