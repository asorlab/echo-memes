import type { ComponentPropsWithoutRef } from "react";

type CardProps = ComponentPropsWithoutRef<"div">;

export default function Card({ children, className = "", ...resto }: CardProps) {
  return (
    <div className={`rounded-lg border border-neutral-800 bg-neutral-900/60 ${className}`} {...resto}>
      {children}
    </div>
  );
}
