import type { Metadata } from "next";
import { MentorProfileView } from "@/components/mentors/mentor-profile-view";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";

export async function generateMetadata({
  params,
}: PageProps<"/mentors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const mentor = SEED_MENTOR_PROFILES.find((m) => m.slug === slug);
  return {
    title: mentor ? mentor.name : "Mentor",
    description: mentor
      ? `${mentor.name} — ${mentor.major} at ${mentor.university} on DapUp.`
      : "DapUp mentor profile.",
  };
}

export default async function MentorDetailPage({
  params,
}: PageProps<"/mentors/[slug]">) {
  const { slug } = await params;
  return (
    <main>
      <MentorProfileView slug={slug} />
    </main>
  );
}
