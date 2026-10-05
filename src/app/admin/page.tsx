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

  if (!ready) {
    return (
      <div className="sheet p-5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-5 h-5 w-full" />
        <Skeleton className="mt-3 h-5 w-full" />
      </div>
    );
  }

  const rows = (profiles ?? []).filter((profile) => profile !== null);
  // Tighter gutters on a phone so three columns fit without scrolling.
  const cell = "px-2.5 py-3 first:pl-5 last:pr-5 sm:px-5";

  return (
    <div className="sheet overflow-x-auto">
      <table className="w-full text-left text-sm sm:text-base">
        <caption className="sr-only">
          Mentor roster with private session rates
        </caption>
        <thead>
          <tr className="text-sm text-muted-foreground">
            <th scope="col" className={`${cell} font-medium`}>
              Mentor
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              University
            </th>
            <th scope="col" className={`${cell} text-right font-medium`}>
              Session rate (private)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t">
              <td colSpan={3} className="px-5 py-6 text-muted-foreground">
                No mentors yet.
              </td>
            </tr>
          ) : (
            rows.map((profile) => (
              <tr key={profile.id} className="border-t">
                <td className={`${cell} font-medium whitespace-nowrap`}>
                  {profile.name}
                </td>
                <td className={`${cell} text-muted-foreground`}>
                  {profile.university}
                </td>
                <td className={`${cell} text-right whitespace-nowrap tabular-nums`}>
                  ${profile.privatePriceUsd} USD
                </td>
              </tr>
            ))
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
    <main className="page">
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="page-title">
            Admin
          </h1>
          <Badge variant="secondary">Admin capability</Badge>
        </div>
        <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
          Placeholder for future admin tooling — mentor approval, reports, and
          moderation will live here.
        </p>
        <section aria-labelledby="admin-mentors-heading" className="mt-14">
          <h2
            id="admin-mentors-heading"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            Mentor roster
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Includes private session rates, visible here through admin
            capability.
          </p>
          <div className="mt-4">
            <AdminMentorTable />
          </div>
        </section>
      </div>
    </main>
  );
}
