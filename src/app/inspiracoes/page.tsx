"use client";
import { Lightbulb } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";
import VirarIdeia from "@/components/assets/VirarIdeia";
import { FORMATOS_CONTEUDO } from "@/lib/formatos";

const MARCAS = [
  { id: "iveasor", rotulo: "IveAsor" }, { id: "asor", rotulo: "ASOR.lab" },
  { id: "aivil", rotulo: "AIVIL" }, { id: "geral", rotulo: "Geral" },
];

const config: AssetLibraryConfig = {
  tabela: "inspiracoes",
  titulo: "Inspirações",
  descricao: "Hooks, shots, looks, cenários, estética.",
  icone: Lightbulb,
  aceitaArquivo: "image/*,video/*",
  tituloPadrao: "Nova inspiração",
  filtroPrincipal: "tipo_inspiracao",
  filtroSecundario: "marca",
  camposDrawer: [
    { key: "marca", label: "Marca", tipo: "chips", opcoes: MARCAS },
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
  acoesDrawer: (item, recarregar) => <VirarIdeia item={item} recarregar={recarregar} />,
};

export default function InspiracoesPage() {
  return <AssetLibrary config={config} />;
}
