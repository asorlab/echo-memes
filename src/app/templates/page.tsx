"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// P3 (30/09): Templates deixou de ser pagina propria — virou filtro
// (tipo='template') dentro de Visuais, que ja usa a mesma tabela. Esse
// arquivo so existe pra quem tiver /templates salvo/linkado continuar
// chegando no lugar certo, sem 404 nem link quebrado.
export default function TemplatesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/visuais?tipo=template");
  }, [router]);
  return null;
}
