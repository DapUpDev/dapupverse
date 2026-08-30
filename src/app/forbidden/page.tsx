import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { TechLabel } from "@/components/brand/tech-label";

export const metadata: Metadata = {
  title: "Not authorized",
};

/** Intentional forbidden experience for authenticated-but-unauthorized access. */
export default function ForbiddenPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <TechLabel aria-hidden="true" className="mx-auto">
            403 / NOT AUTHORIZED
          </TechLabel>
          <CardTitle className="font-display">
            You don&rsquo;t have access to that page
          </CardTitle>
          <CardDescription>
            This area requires a different account type or capability. If you
            think that&rsquo;s wrong, contact the DapUp team.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <ButtonLink href="/app">Back to your DapUp</ButtonLink>
          <ButtonLink variant="outline" href="/mentors">
            Browse mentors
          </ButtonLink>
        </CardContent>
      </Card>
    </main>
  );
}
