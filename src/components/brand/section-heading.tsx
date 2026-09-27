import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section opener: technical index label above an editorial display heading,
 * underlined by a thin metallic rule.
 */
export function SectionHeading({
  id,
  index,
  label,
  children,
  className,
}: {
  id: string;
  /** Technical index, e.g. "01". */
  index?: string;
  /** Short technical annotation, e.g. "HOW IT WORKS". */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <span aria-hidden="true" className="tech-label block">
          {index ? `${index} / ` : ""}
          {label}
        </span>
      ) : null}
      <h2
        id={id}
        className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
      >
        {children}
      </h2>
      <div
        aria-hidden="true"
        className="h-px w-16 bg-gradient-to-r from-chrome to-transparent"
      />
    </div>
  );
}
