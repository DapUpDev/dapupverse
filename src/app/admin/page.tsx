"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoSession } from "@/lib/demo-session/provider";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import { mentorRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

function AdminMentorTable() {
  const { data: profiles, ready } = useRepositoryQuery(
    async () =>
      Promise.all(
        SEED_MENTOR_PROFILES.map((m) =>
          mentorRepository.getPrivateProfile(m.id),
        ),
      ),
    [],
  );

  if (!ready) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Mentor roster with private session rates
        </caption>
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th scope="col" className="px-4 py-2 font-medium">
              Mentor
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              University
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Session rate (private)
            </th>
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((profile) =>
            profile ? (
              <tr key={profile.id} className="border-b last:border-0">
                <td className="px-4 py-2">{profile.name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {profile.university}
                </td>
                <td className="px-4 py-2">${profile.privatePriceUsd} USD</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Admin-capability placeholder. Access is gated on the explicit `isAdmin`
 * capability — being a mentor is never enough on its own.
 */
export default function AdminPage() {
  const { session } = useDemoSession();

  if (!session.capabilities.isAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Admin capability required</CardTitle>
            <CardDescription>
              This area is available only to users with admin capability. In
              the demo, switch the preview role to &ldquo;Mentor +
              admin&rdquo;.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <Badge variant="secondary">Admin capability</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">
        Placeholder for future admin tooling — mentor approval, reports, and
        moderation will live here.
      </p>
      <section aria-labelledby="admin-mentors-heading" className="mt-8">
        <h2 id="admin-mentors-heading" className="text-lg font-semibold">
          Mentor roster
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Includes private session rates, visible here through admin
          capability.
        </p>
        <div className="mt-3">
          <AdminMentorTable />
        </div>
      </section>
    </main>
  );
}
