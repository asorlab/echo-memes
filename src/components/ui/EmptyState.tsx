import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
}

export default function EmptyState({ icone: Icone, titulo, descricao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
      <Icone className="h-6 w-6 text-neutral-600" />
      <p className="text-sm font-medium text-neutral-300">{titulo}</p>
      {descricao && <p className="max-w-xs text-xs text-neutral-500">{descricao}</p>}
    </div>
  );
}
