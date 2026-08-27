"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MentorCard } from "@/components/mentors/mentor-card";
import {
  MentorFiltersPanel,
  type MentorFilterOptions,
} from "@/components/mentors/mentor-filters-panel";
import { countActiveFilters } from "@/lib/domain/filter-mentors";
import type { MentorFilters } from "@/lib/domain/types";
import { mentorRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

export function MentorDirectory() {
  const [filters, setFilters] = useState<MentorFilters>({});
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const activeFilterCount = countActiveFilters(filters);
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
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

        {/* Mobile filters */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={<Button variant="outline" className="lg:hidden" />}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <MentorFiltersPanel
                idPrefix="sheet"
                filters={filters}
                options={options}
                onChange={setFilters}
              />
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={clearAll}>
                Clear all filters
              </Button>
              <Button onClick={() => setSheetOpen(false)}>Show results</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Desktop filters */}
        <aside aria-label="Mentor filters" className="hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <span aria-hidden="true" className="tech-label">
              FILTERS
            </span>
            <MentorFiltersPanel
              idPrefix="sidebar"
              filters={filters}
              options={options}
              onChange={setFilters}
            />
            <Button
              variant="outline"
              onClick={clearAll}
              disabled={activeFilterCount === 0}
            >
              Clear all filters
            </Button>
          </div>
        </aside>

        <section aria-label="Mentor results">
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
    </div>
  );
}
