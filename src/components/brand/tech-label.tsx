import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Technical microtype label — monospace, uppercase, wide tracking. Used for
 * metadata, statuses, coordinates, and decorative annotations. Decorative
 * instances should pass aria-hidden.
 */
export function TechLabel({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("tech-label block", className)} {...props}>
      {children}
    </span>
  );
}
