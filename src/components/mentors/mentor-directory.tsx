"use client";

import { useMemo, useState } from "react";
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

export function MentorDirectory() {
  const [filters, setFilters] = useState<MentorFilters>({});

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2">
        <span aria-hidden="true" className="tech-label">
          DIRECTORY / SELECTED MENTORS
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Find a mentor
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Search a selected group of student mentors by name, school,
          expertise, or subject.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mentor-search">Search</Label>
          <Input
            id="mentor-search"
            type="search"
            placeholder="Name, university, expertise, or subject"
            value={filters.query ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, query: event.target.value }))
            }
          />
        </div>
        <MentorFilterBar
          filters={filters}
          options={options}
          onChange={setFilters}
          onClear={clearAll}
        />
      </div>

      <section aria-label="Mentor results" className="mt-8">
        <p
          aria-live="polite"
          className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
        >
          {ready && mentors
            ? `${mentors.length} mentor${mentors.length === 1 ? "" : "s"} found`
            : "Loading mentors…"}
        </p>

        {!ready ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : mentors && mentors.length > 0 ? (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-dashed border-fog/50 bg-card/40 p-8">
            <span aria-hidden="true" className="tech-label">
              0 RESULTS
            </span>
            <p className="font-display text-lg font-bold">
              No mentors match your search.
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different subject or clear your filters to see everyone.
            </p>
            <Button variant="outline" onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
