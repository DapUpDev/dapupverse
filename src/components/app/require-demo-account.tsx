"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { useDemoSession } from "@/lib/demo-session/provider";
import type { AccountType } from "@/lib/domain/types";

/**
 * Client-side guard for /app pages in preview environments. A visitor (no
 * demo identity selected) is asked to pick a preview role instead of seeing
 * account content. This is demo flow control, not authorization.
 */
export function RequireDemoAccount({
  accountType,
  children,
}: {
  /** Restrict to one account type; omit to allow any signed-in demo identity. */
  accountType?: AccountType;
  children: ReactNode;
}) {
  const { session } = useDemoSession();

  if (!session.userId) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Pick a preview role to continue</CardTitle>
            <CardDescription>
              This area shows the signed-in experience. Use the
              &ldquo;Preview role&rdquo; menu in the header to preview as a
              student or mentor with mock data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ButtonLink variant="outline" href="/mentors">
              Browse mentors instead
            </ButtonLink>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (accountType && session.accountType !== accountType) {
    const label = accountType === "student" ? "students" : "mentors";
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>This page is for {label}</CardTitle>
            <CardDescription>
              Switch the preview role in the header to see this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}
