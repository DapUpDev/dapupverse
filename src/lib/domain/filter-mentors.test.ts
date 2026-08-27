import { describe, expect, it } from "vitest";
import { countActiveFilters, filterMentors } from "@/lib/domain/filter-mentors";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import { toPublicMentor } from "@/lib/repositories/mock";

const mentors = SEED_MENTOR_PROFILES.map(toPublicMentor);

describe("filterMentors", () => {
  it("returns all mentors with no filters (clear-all behavior)", () => {
    expect(filterMentors(mentors)).toHaveLength(mentors.length);
    expect(filterMentors(mentors, {})).toHaveLength(mentors.length);
  });

  it("searches across name, university, expertise, and subjects", () => {
    expect(filterMentors(mentors, { query: "Jae" }).map((m) => m.slug)).toEqual(
      ["jae-park"],
    );
    expect(
      filterMentors(mentors, { query: "cambridge" }).map((m) => m.slug),
    ).toEqual(["mira-chen"]);
    expect(
      filterMentors(mentors, { query: "medicine" }).map((m) => m.slug),
    ).toEqual(["hana-sato"]);
    const economics = filterMentors(mentors, { query: "economics" });
    expect(economics.length).toBeGreaterThan(0);
    expect(
      economics.every((m) =>
        [m.major, ...m.subjects].join(" ").toLowerCase().includes("economics"),
      ),
    ).toBe(true);
  });

  it("filters by education system", () => {
    const result = filterMentors(mentors, { educationSystem: "AP" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((m) => m.educationSystems.includes("AP"))).toBe(true);
  });

  it("filters by subject, country, university, and service type", () => {
    expect(
      filterMentors(mentors, { subject: "Physics" }).every((m) =>
        m.subjects.includes("Physics"),
      ),
    ).toBe(true);
    expect(
      filterMentors(mentors, { countryRegion: "New Zealand" }).map(
        (m) => m.slug,
      ),
    ).toEqual(["ana-silva"]);
    expect(
      filterMentors(mentors, { university: "MIT" }).map((m) => m.slug),
    ).toEqual(["daniel-okafor"]);
    expect(
      filterMentors(mentors, { serviceType: "Portfolio review" }).every((m) =>
        m.services.includes("Portfolio review"),
      ),
    ).toBe(true);
  });

  it("combines filters and reports an empty result when nothing matches", () => {
    const result = filterMentors(mentors, {
      educationSystem: "IB",
      countryRegion: "New Zealand",
    });
    expect(result).toHaveLength(0);
  });

  it("counts active filters for the clear-all affordance", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ query: "  " })).toBe(0);
    expect(
      countActiveFilters({ query: "a", educationSystem: "IB", subject: "x" }),
    ).toBe(3);
  });
});
