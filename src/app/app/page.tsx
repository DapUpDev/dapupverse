"use client";

import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequireDemoAccount } from "@/components/app/require-demo-account";
import { navItemsForSession } from "@/components/shell/navigation";
import { useDemoSession } from "@/lib/demo-session/provider";

function AppEntry() {
  const { session } = useDemoSession();
  const items = navItemsForSession(session).filter(
    (item) => item.href !== "/mentors",
  );
  const greeting =
    session.accountType === "mentor"
      ? "Manage your requests, connections, and conversations."
      : "Pick up where you left off with your mentors.";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Your DapUp</h1>
      <p className="mt-1 text-muted-foreground">{greeting}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.href} className="relative transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>
                <Link href={item.href} className="after:absolute after:inset-0">
                  {item.label}
                </Link>
              </CardTitle>
              <CardDescription>
                {
                  {
                    "/app/connections": "Your mentors and pending requests.",
                    "/app/requests": "Incoming student requests.",
                    "/app/messages": "Your conversations.",
                    "/app/profile": "View and edit your profile.",
                    "/admin": "Admin tools (admin capability).",
                  }[item.href]
                }
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}

export default function AppEntryPage() {
  return (
    <RequireDemoAccount>
      <AppEntry />
    </RequireDemoAccount>
  );
}
