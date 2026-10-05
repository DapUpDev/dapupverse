import type { Metadata } from "next";
import { MentorDirectory } from "@/components/mentors/mentor-directory";
import {
  EDUCATION_SYSTEMS,
  SERVICE_TYPES,
  type MentorFilters,
} from "@/lib/domain/types";

export const metadata: Metadata = {
  title: "Find Mentors",
  description:
    "Browse DapUp's selected student mentors by subject, education system, and university.",
};

export default async function MentorsPage({
  searchParams,
}: PageProps<"/mentors">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" && value ? value.slice(0, 120) : undefined;
  };
  // The landing page's sentence links here with its choices. Anything that
  // is not a known value is dropped rather than trusted.
  const initialFilters: MentorFilters = {
    educationSystem: EDUCATION_SYSTEMS.find(
      (s) => s === one("educationSystem"),
    ),
    serviceType: SERVICE_TYPES.find((s) => s === one("serviceType")),
    university: one("university"),
  };

  return (
    <main>
      <MentorDirectory initialFilters={initialFilters} />
    </main>
  );
}
