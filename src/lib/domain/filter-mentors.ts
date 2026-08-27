import type { Mentor, MentorFilters } from "@/lib/domain/types";

/** Pure mentor filtering used by the directory and the mock repository. */
export function filterMentors<M extends Mentor>(
  mentors: M[],
  filters: MentorFilters = {},
): M[] {
  const query = filters.query?.trim().toLowerCase();
  return mentors.filter((mentor) => {
    if (query) {
      const haystack = [
        mentor.name,
        mentor.university,
        mentor.major,
        ...mentor.subjects,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (
      filters.educationSystem &&
      !mentor.educationSystems.includes(filters.educationSystem)
    ) {
      return false;
    }
    if (filters.subject && !mentor.subjects.includes(filters.subject)) {
      return false;
    }
    if (filters.countryRegion && mentor.countryRegion !== filters.countryRegion) {
      return false;
    }
    if (filters.university && mentor.university !== filters.university) {
      return false;
    }
    if (filters.serviceType && !mentor.services.includes(filters.serviceType)) {
      return false;
    }
    return true;
  });
}

export function countActiveFilters(filters: MentorFilters): number {
  let count = 0;
  if (filters.query?.trim()) count += 1;
  if (filters.educationSystem) count += 1;
  if (filters.subject) count += 1;
  if (filters.countryRegion) count += 1;
  if (filters.university) count += 1;
  if (filters.serviceType) count += 1;
  return count;
}
