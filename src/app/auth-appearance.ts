import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";

/*
 * Clerk's prebuilt sign-in and sign-up laid flat on one Desk sheet: ink button,
 * the app's own control edges, no Clerk gradient.
 */
export const authAppearance: ComponentProps<typeof SignIn>["appearance"] = {
  theme: "simple",
  options: { elevation: "flush" },
  variables: {
    colorPrimary: "var(--primary)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorNeutral: "var(--foreground)",
    colorInputForeground: "var(--foreground)",
    colorDanger: "var(--destructive)",
    colorRing: "color-mix(in srgb, var(--ring) 30%, transparent)",
    fontSize: "0.875rem",
    borderRadius: "var(--radius)",
  },
  elements: {
    // Clerk sizes the root to its content and the card to a fixed
    // width; the sheet takes the width instead and the card fills it.
    rootBox: "sheet w-full! max-w-[26rem] p-7 shadow-sheet sm:p-10",
    cardBox: { width: "100%", maxWidth: "none" },
    headerTitle: {
      fontFamily: "var(--font-display)",
      fontSize: "1.5rem",
      lineHeight: 1.15,
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    socialButtonsIconButton: {
      minHeight: "2.5rem",
      borderColor:
        "color-mix(in srgb, var(--foreground) 25%, transparent)",
    },
    formFieldInput: {
      minHeight: "2.5rem",
      borderColor: "var(--input)",
      "&:hover": { borderColor: "var(--input)" },
      "&:focus-visible": { borderColor: "var(--ring)" },
    },
    formButtonPrimary: {
      minHeight: "2.5rem",
      "&:active": { transform: "scale(0.97)" },
    },
    // A perforation, not Clerk's grey band, sets the footer apart.
    footer: {
      marginTop: "2rem",
      paddingTop: "1.5rem",
      borderTop:
        "1px dashed color-mix(in srgb, var(--foreground) 25%, transparent)",
    },
    footerActionLink: { textDecoration: "underline" },
  },
};
