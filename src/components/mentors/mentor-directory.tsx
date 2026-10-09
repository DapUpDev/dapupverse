"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MentorCard } from "@/components/mentors/mentor-card";
import {
  MentorFilterBar,
  type MentorFilterOptions,
} from "@/components/mentors/mentor-filter-bar";
import type { MentorFilters } from "@/lib/domain/types";
import { mentorRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

const grid = "mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function MentorDirectory({
  initialFilters = {},
}: {
  /** Filters to start with, e.g. the landing page's sentence. */
  initialFilters?: MentorFilters;
}) {
  const [filters, setFilters] = useState<MentorFilters>(initialFilters);

  const { data: allMentors } = useRepositoryQuery(
    () => mentorRepository.list(),
    [],
  );
  const { data: mentors, ready } = useRepositoryQuery(
    () => mentorRepository.list(filters),
    [filters],
  );

  const options = useMemo<MentorFilterOptions>(() => {
    const subjects = new Set<string>();
    const countries = new Set<string>();
    const universities = new Set<string>();
    for (const mentor of allMentors ?? []) {
      mentor.subjects.forEach((s) => subjects.add(s));
      countries.add(mentor.countryRegion);
      universities.add(mentor.university);
    }
    return {
      subjects: [...subjects].sort(),
      countries: [...countries].sort(),
      universities: [...universities].sort(),
    };
  }, [allMentors]);

  const clearAll = () => setFilters({});

  return (
    <div className="page">
      <h1 className="page-title">
        Find a mentor
      </h1>
      <p className="mt-3 max-w-xl text-lg text-pretty text-muted-foreground">
        Search a selected group of student mentors by name, school,
        expertise, or subject.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex max-w-xl flex-col gap-1.5">
          <Label htmlFor="mentor-search">Search</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            />
            <Input
              id="mentor-search"
              type="search"
              className="pl-9 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-cancel-button]:opacity-60 [&::-webkit-search-cancel-button]:brightness-0"
              placeholder="Name, university, expertise, or subject"
              value={filters.query ?? ""}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, query: event.target.value }))
              }
            />
          </div>
        </div>
        <MentorFilterBar
          filters={filters}
          options={options}
          onChange={setFilters}
          onClear={clearAll}
        />
      </div>

      <section aria-label="Mentor results" className="mt-10">
        <p aria-live="polite" className="text-sm text-subtle tabular-nums">
          {ready && mentors
            ? `${mentors.length} mentor${mentors.length === 1 ? "" : "s"} found`
            : "Loading mentors…"}
        </p>

        {!ready ? (
          <div className={grid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="sheet p-5">
                <div className="flex gap-4">
                  <Skeleton className="size-20 rounded-[4px]" />
                  <div className="flex-1 pt-1">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2.5 h-4 w-full" />
                  </div>
                </div>
                <Skeleton className="mt-5 h-16 w-full" />
                <Skeleton className="mt-5 h-9 w-28" />
              </div>
            ))}
          </div>
        ) : mentors && mentors.length > 0 ? (
          <div className={grid}>
            {mentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>
        ) : (
          // An empty place on the desk where the cards would lie.
          <div className="mt-4 flex max-w-xl flex-col items-start rounded-[6px] border border-dashed border-foreground/25 p-7 sm:p-9">
            <p className="font-display text-xl font-semibold">
              No mentors match your search.
            </p>
            <p className="mt-2 text-muted-foreground">
              Try a different subject or clear your filters to see everyone.
            </p>
            <Button variant="outline" className="mt-6" onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
