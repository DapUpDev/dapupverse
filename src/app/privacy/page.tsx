import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "DapUp Privacy Policy.",
};

/*
 * Route shell only. The final Privacy Policy has not been written yet and
 * must NOT be invented here — real privacy copy is required from the DapUp
 * team (with legal review) before any public launch.
 */
export default function PrivacyPage() {
  return (
    <main className="page">
      <article className="sheet mx-auto max-w-[40rem] p-7 shadow-sheet sm:p-12 md:p-16">
        <h1 className="page-title">
          Privacy Policy
        </h1>
        {/* A quiet fill, not a second sheet: paper never sits on paper. */}
        <Alert className="mt-8 gap-1 border-0 p-5 text-base has-[>svg]:gap-x-3">
          <Info className="size-5" strokeWidth={1.75} aria-hidden="true" />
          <AlertTitle>Privacy Policy coming soon</AlertTitle>
          <AlertDescription className="text-base leading-7">
            DapUp&rsquo;s full Privacy Policy is being prepared and will be
            published here before launch. Until then, no statements about data
            handling are made on this page. For questions, contact{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>
            .
          </AlertDescription>
        </Alert>
      </article>
    </main>
  );
}
