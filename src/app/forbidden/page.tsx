import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Not authorized",
};

/** Intentional forbidden experience for authenticated-but-unauthorized access. */
export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-10">
      <div className="sheet w-full max-w-md p-8 shadow-sheet sm:p-10">
        <h1 className="font-display text-3xl leading-[1.1] font-semibold tracking-[-0.025em]">
          You don&rsquo;t have access to that page
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground">
          This area requires a different account type or capability. If you
          think that&rsquo;s wrong, contact the DapUp team.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/app">Back to your DapUp</ButtonLink>
          <ButtonLink variant="outline" href="/mentors">
            Browse mentors
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
