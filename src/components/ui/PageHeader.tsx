import type { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}

export default function PageHeader({ titulo, descricao, acao }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-neutral-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}
