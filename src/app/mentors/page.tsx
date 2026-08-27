import type { Metadata } from "next";
import { MentorDirectory } from "@/components/mentors/mentor-directory";

export const metadata: Metadata = {
  title: "Find Mentors",
  description:
    "Browse DapUp's selected student mentors by subject, education system, and university.",
};

export default function MentorsPage() {
  return (
    <main>
      <MentorDirectory />
    </main>
  );
}
