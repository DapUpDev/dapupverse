"use client";

import Link from "next/link";
import { useState } from "react";
import { MentorCard } from "@/components/mentors/mentor-card";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { filterMentors } from "@/lib/domain/filter-mentors";
import {
  EDUCATION_SYSTEMS,
  SERVICE_TYPES,
  type EducationSystem,
  type ServiceType,
} from "@/lib/domain/types";
import { UniversityMarquee } from "@/components/home/university-marquee";
import { mentorRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";
import { cn } from "@/lib/utils";

// The fan on wide screens, by rank: the front card, then up to two name
// strips peeking out above it. Only matches are fanned; every other card
// waits under the last strip, so a new match always travels from where it
// already lies. Narrow screens list the first two.
const FAN = [
  "lg:z-30",
  "lg:z-20 lg:translate-x-5 lg:-translate-y-[6.25rem] lg:rotate-[1.2deg]",
  "max-lg:hidden lg:z-10 lg:translate-x-10 lg:-translate-y-[12.5rem] lg:-rotate-[0.8deg]",
];
const WAITING =
  "max-lg:hidden lg:translate-x-10 lg:-translate-y-[12.5rem] lg:opacity-0";
// ponytail: only the first 8 by rank stay mounted; past that a new match
// mounts in place. Raise it if the directory outgrows the fan.
const MOUNTED = 8;
// Fewer strips above the front card: lift the fan so it still starts at the top.
const LIFT = ["", "lg:-translate-y-[12.5rem]", "lg:-translate-y-[6.25rem]", ""];
const slot =
  "lg:col-start-1 lg:row-start-1 lg:self-start transition-[translate,rotate,scale,opacity] duration-[600ms] ease-desk has-[>button:active]:scale-[0.985] lg:[&>article]:shadow-sheet";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * A fill-in blank inside the sentence: a select drawn as highlighted text.
 * The list is our own paper menu; a native select's list is drawn by the
 * browser in a box the page cannot style.
 */
function Blank<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        aria-label={label}
        className="mx-[0.05em] inline-flex h-auto cursor-pointer gap-[0.2em] rounded-[4px] border-0 bg-mark py-0 pr-[0.3em] pl-[0.3em] align-baseline text-[length:inherit] leading-[1.3] transition-[scale] hover:shadow-[0_0_0_2px_var(--foreground)] active:scale-[0.98] md:text-[length:inherit] data-placeholder:text-foreground [&_svg]:text-foreground"
      >
        <SelectValue>
          {(v: T) => options.find(([option]) => option === v)?.[1]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className="w-auto font-sans tracking-normal"
      >
        {options.map(([option, text]) => (
          <SelectItem key={option} value={option}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The top of the landing page: a request slip whose sentence filters the
 * real mentors, the fan of their cards it reorders, and the faces of the
 * group itself.
 */
export function HomeDesk() {
  const { data, ready } = useRepositoryQuery(() => mentorRepository.list(), []);
  const mentors = data ?? [];
  const [system, setSystem] = useState<EducationSystem>();
  const [service, setService] = useState<ServiceType>(SERVICE_TYPES[0]);
  const [university, setUniversity] = useState("");
  const [frontId, setFrontId] = useState<string>();

  const universities = [...new Set(mentors.map((m) => m.university))].sort();
  // Until the visitor chooses, start on an exam system someone here studied.
  const chosenSystem =
    system ??
    EDUCATION_SYSTEMS.find((s) =>
      mentors.some((m) => m.educationSystems.includes(s)),
    ) ??
    EDUCATION_SYSTEMS[0];
  const hits = filterMentors(mentors, {
    educationSystem: chosenSystem,
    serviceType: service,
    university: university || undefined,
  });
  // The fan holds the matches; with none, whoever is here.
  const shown = hits.length > 0 ? hits : mentors;
  const front = mentors.find((m) => m.id === frontId);
  // ponytail: Sunny then David are pinned to the front by name for now; swap
  // for a "featured" flag on the mentor when more people need pinning.
  const pinned = ["Sunny", "David"].flatMap((first) =>
    mentors.filter((m) => m.name.startsWith(first)),
  );
  // One fixed deal: pinned, then the matches, then everyone else. The fan is
  // that deck turned so the chosen card is on top, so the arrows (and a tap
  // on a card behind) always move through the deck in order.
  const deck = [...new Set([...pinned, ...shown, ...mentors])].slice(
    0,
    MOUNTED,
  );
  const at = Math.max(deck.indexOf(front ?? deck[0]), 0);
  const ranked = [...deck.slice(at), ...deck.slice(0, at)];
  const fanned = Math.min(shown.length, FAN.length);
  const step = (by: number) =>
    setFrontId(deck[(at + by + deck.length) % deck.length]?.id);
  // Rendered in a fixed order so a card keeps its element as its rank changes.
  const mounted = [...ranked].sort((a, b) => a.id.localeCompare(b.id));
  const marked = [chosenSystem, service, university].filter(Boolean);
  const directory = `/mentors?${new URLSearchParams({
    educationSystem: chosenSystem,
    serviceType: service,
    ...(university ? { university } : {}),
  })}`;

  // A new sentence puts its own match on top again.
  const choose =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setFrontId(undefined);
    };

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <div className="grid min-w-0 gap-6">
          <section
            aria-labelledby="hero-heading"
            className="sheet min-w-0 p-7 shadow-sheet sm:p-10 lg:p-16"
          >
            <h1
              id="hero-heading"
              className="font-display text-[clamp(2.6rem,4.6vw+0.6rem,5rem)] leading-none font-[450] tracking-[-0.03em]"
            >
              Learn from students who&rsquo;ve <mark>already made it.</mark>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg text-pretty text-muted-foreground">
              DapUp connects you with mentors who sat the same exams, wrote the
              same applications, and got into the places you&rsquo;re aiming
              for.
            </p>

            <div
              role="group"
              aria-label="Find your mentor"
              className="mt-8 border-t border-border pt-7 lg:mt-11 lg:pt-9"
            >
              <p className="font-display text-[clamp(1.3rem,1.3vw+0.9rem,1.75rem)] leading-[1.5] font-medium tracking-[-0.015em]">
                I&rsquo;m on{" "}
                <Blank
                  label="Your exam system"
                  value={chosenSystem}
                  onChange={choose(setSystem)}
                  options={EDUCATION_SYSTEMS.map((s) => [s, s])}
                />{" "}
                and want{" "}
                <Blank
                  label="What you want help with"
                  value={service}
                  onChange={choose(setService)}
                  options={SERVICE_TYPES.map((s) => [s, s.toLowerCase()])}
                />{" "}
                from a student at{" "}
                <Blank
                  label="University"
                  value={university}
                  onChange={choose(setUniversity)}
                  options={[
                    ["", "any university"],
                    ...universities.map((u) => [u, u] as const),
                  ]}
                />
                .
              </p>
              <p
                role="status"
                aria-live="polite"
                className="mt-4 min-h-6 text-muted-foreground"
              >
                {!ready ? (
                  "Finding mentors…"
                ) : mentors.length === 0 ? (
                  "Mentors are being approved. Check back soon."
                ) : (
                  <>
                    {hits.length === 0 ? (
                      "No mentor matches that yet. Here is everyone who is here."
                    ) : (
                      <>
                        <strong className="font-semibold text-foreground">
                          {hits.length === 1
                            ? hits[0].name.split(" ")[0]
                            : plural(hits.length, "mentor", "mentors")}
                        </strong>{" "}
                        can help with that.
                      </>
                    )}{" "}
                    <Link
                      href={hits.length > 1 ? directory : "/mentors"}
                      className="text-foreground underline"
                    >
                      {hits.length > 1
                        ? `See all ${hits.length}`
                        : "Browse all mentors"}
                    </Link>
                  </>
                )}
              </p>
            </div>

            <p className="mt-7 text-sm text-subtle tabular-nums">
              {ready && mentors.length > 0
                ? `${plural(mentors.length, "mentor", "mentors")} · ${plural(universities.length, "university", "universities")} · `
                : ""}
              AP, IB and A Levels.
            </p>
          </section>
        </div>

        <div
          aria-label="Mentors"
          role="group"
          className={cn(
            "relative z-10 grid gap-4 transition-[translate] duration-[600ms] ease-desk lg:-ml-[4.5rem] lg:pt-[12.5rem]",
            LIFT[fanned],
          )}
        >
          {!ready
            ? FAN.slice(0, 2).map((place) => (
                <div key={place} className={cn("sheet p-5", slot, place)}>
                  <Skeleton className="size-20 rounded-[4px]" />
                  <Skeleton className="mt-4 h-5 w-2/3" />
                  <Skeleton className="mt-6 h-24 w-full" />
                </div>
              ))
            : mounted.map((mentor) => {
                const rank = ranked.indexOf(mentor);
                const inFan = rank < fanned;
                return (
                  <div
                    key={mentor.id}
                    style={{ order: rank }}
                    inert={!inFan}
                    className={cn(slot, inFan ? FAN[rank] : WAITING)}
                  >
                    <MentorCard
                      mentor={mentor}
                      primary={rank === 0}
                      marked={hits.includes(mentor) ? marked : []}
                      onStep={rank === 0 && deck.length > 1 ? step : undefined}
                    />
                    {inFan && rank > 0 && (
                      <button
                        type="button"
                        aria-label={`Bring ${mentor.name}'s card to the front`}
                        className="absolute inset-0 hidden rounded-[6px] lg:block"
                        onClick={() => setFrontId(mentor.id)}
                      />
                    )}
                  </div>
                );
              })}
        </div>
      </div>

      <UniversityMarquee universities={universities} />

      <section
        aria-labelledby="network-heading"
        className="bleed mt-20 bg-[var(--block-dark)] py-24 text-white lg:mt-28 lg:py-32"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
          <div>
            <h2
              id="network-heading"
              className="font-display text-[clamp(1.9rem,2.4vw+1rem,3rem)] leading-[1.05] font-[450] tracking-[-0.025em] text-balance"
            >
              A small, approved group of successful NZ friends who went
              overseas.
            </h2>
            <p className="mt-5 max-w-xl text-lg text-pretty text-white/70">
              Every DapUp mentor is reviewed and approved before they appear in
              the directory, so the advice you get comes from students who have
              genuinely done it.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-4">
            {!ready
              ? [0, 1, 2, 3].map((i) => (
                  <li key={i} className="sheet p-5">
                    <Skeleton className="size-16 rounded-full" />
                    <Skeleton className="mt-4 h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-full" />
                  </li>
                ))
              : [...new Set([...pinned, ...mentors])]
                  .slice(0, 4)
                  .map((mentor) => (
                    <li key={mentor.id}>
                      <Link
                        href={`/mentors/${mentor.slug}`}
                        className="sheet block p-5 text-foreground transition-[scale] duration-150 ease-out outline-none hover:shadow-sheet active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:p-6"
                      >
                        <ProfileAvatar
                          name={mentor.name}
                          avatarUrl={mentor.avatarUrl}
                          className="size-16 [&_[data-slot=avatar-fallback]]:text-lg"
                        />
                        <span className="mt-4 block truncate font-medium">
                          {mentor.name}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-muted-foreground">
                          {mentor.major} at {mentor.university}
                        </span>
                      </Link>
                    </li>
                  ))}
          </ul>
        </div>
      </section>
    </>
  );
}
