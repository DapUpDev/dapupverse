"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Toasts are slips of paper: white, hairline edge, the popup shadow. Done is
// a ticked ring on the highlighter; an error is the one red mark.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 fill-mark" strokeWidth={1.75} />
        ),
        error: (
          <OctagonXIcon className="size-4 text-destructive" strokeWidth={1.75} />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "items-start! text-sm! shadow-pop!",
          icon: "mt-0.5!",
          description: "text-muted-foreground!",
        },
      }}
      style={
        {
          fontFamily: "inherit",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
