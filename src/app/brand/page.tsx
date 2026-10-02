"use client";
import { Gem } from "lucide-react";
import AssetLibrary, { type AssetLibraryConfig } from "@/components/assets/AssetLibrary";

const config: AssetLibraryConfig = {
  tabela: "brand_assets",
  titulo: "Brand Assets",
  descricao: "Logo, marca d'água, assinatura.",
  icone: Gem,
  aceitaArquivo: "image/*",
  tituloPadrao: "Novo brand asset",
  filtroPrincipal: "tipo",
  camposDrawer: [
    {
      key: "tipo", label: "Tipo", tipo: "select",
      opcoes: [
        { id: "logo", rotulo: "Logo" }, { id: "marca_dagua", rotulo: "Marca d'água" },
        { id: "assinatura", rotulo: "Assinatura" }, { id: "icone", rotulo: "Ícone" }, { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      key: "cor", label: "Cor", tipo: "chips",
      opcoes: [{ id: "colorido", rotulo: "Colorido" }, { id: "branco", rotulo: "Branco" }, { id: "preto", rotulo: "Preto" }, { id: "outro", rotulo: "Outro" }],
    },
    { key: "tags", label: "Tags", tipo: "tags", placeholder: "tags: instagram, tiktok..." },
  ],
};

export default function BrandAssetsPage() {
  return <AssetLibrary config={config} />;
}
