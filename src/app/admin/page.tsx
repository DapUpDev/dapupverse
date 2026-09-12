"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { mentorRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

function AdminMentorTable() {
  // Public list, then each private record: the repository (and, behind it,
  // the API) is what grants admin visibility of the price.
  const { data: profiles, ready } = useRepositoryQuery(async () => {
    const mentors = await mentorRepository.list();
    return Promise.all(mentors.map((m) => mentorRepository.getPrivateProfile(m.id)));
  }, []);

  if (!ready) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Mentor roster with private session rates
        </caption>
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th
              scope="col"
              className="px-4 py-2 font-mono text-xs font-medium tracking-widest uppercase"
            >
              Mentor
            </th>
            <th
              scope="col"
              className="px-4 py-2 font-mono text-xs font-medium tracking-widest uppercase"
            >
              University
            </th>
            <th
              scope="col"
              className="px-4 py-2 font-mono text-xs font-medium tracking-widest uppercase"
            >
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
 * Admin tools placeholder. Access is enforced server-side in the /admin
 * layout via the explicit isAdmin capability.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <span aria-hidden="true" className="tech-label">
        CAPABILITY / ADMIN — DISTINCT FROM ACCOUNT TYPE
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Admin
        </h1>
        <Badge variant="secondary" className="border border-chrome/50">
          Admin capability
        </Badge>
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
