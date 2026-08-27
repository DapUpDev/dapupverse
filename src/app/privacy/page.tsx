import type { Metadata } from "next";
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
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <article className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <Alert>
          <AlertTitle>Privacy Policy coming soon</AlertTitle>
          <AlertDescription>
            DapUp&rsquo;s full Privacy Policy is being prepared and will be
            published here before launch. Until then, no statements about data
            handling are made on this page. For questions, contact{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium underline underline-offset-4"
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
