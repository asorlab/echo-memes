"use client";
import { Lightbulb } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const FORMATOS_CONTEUDO = [
  { id: "vlog", rotulo: "Vlog" }, { id: "grwm", rotulo: "GRWM" }, { id: "gaming", rotulo: "Gaming" },
  { id: "lifestyle", rotulo: "Lifestyle" }, { id: "cover", rotulo: "Cover" }, { id: "asmr", rotulo: "ASMR" }, { id: "short_form", rotulo: "Short-form" },
];

const config: AssetLibraryConfig = {
  tabela: "inspiracoes",
  titulo: "Inspirações",
  descricao: "Hooks, shots, looks, cenários, estética — o que quero lembrar.",
  icone: Lightbulb,
  aceitaArquivo: "image/*,video/*",
  tituloPadrao: "Nova inspiração",
  filtroPrincipal: "tipo_inspiracao",
  camposDrawer: [
    {
      key: "categoria", label: "Formato (o que salvei)", tipo: "select",
      opcoes: [
        { id: "video", rotulo: "Vídeo" }, { id: "imagem", rotulo: "Imagem" }, { id: "texto", rotulo: "Texto" },
        { id: "conta_perfil", rotulo: "Conta/perfil" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      key: "tipo_inspiracao", label: "Tipo (por que salvei)", tipo: "chips",
      opcoes: [
        { id: "hook", rotulo: "Hook" }, { id: "shot_enquadramento", rotulo: "Shot/Enquadramento" }, { id: "look", rotulo: "Look" },
        { id: "cenario", rotulo: "Cenário" }, { id: "pose", rotulo: "Pose" }, { id: "thumbnail", rotulo: "Thumbnail" },
        { id: "storytelling", rotulo: "Storytelling" }, { id: "estetica", rotulo: "Estética" }, { id: "ideia_video", rotulo: "Ideia de vídeo" },
        { id: "creator_conta", rotulo: "Creator/Conta" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      key: "status", label: "Status", tipo: "chips",
      opcoes: [{ id: "quero_testar", rotulo: "Quero testar" }, { id: "testado", rotulo: "Testado" }],
    },
    { key: "formato_conteudo", label: "Onde usar", tipo: "chips-multi", opcoes: FORMATOS_CONTEUDO },
    { key: "nota", label: "Por que inspira", tipo: "textarea", placeholder: "O que chamou atenção" },
    { key: "criador", label: "Creator/origem", tipo: "text", placeholder: "@quem postou" },
    { key: "plataforma", label: "Plataforma", tipo: "text", placeholder: "TikTok, Instagram..." },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: estetica, roteiro..." },
  ],
};

export default function InspiracoesPage() {
  return <AssetLibrary config={config} />;
}
