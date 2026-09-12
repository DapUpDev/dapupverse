import type { Metadata } from "next";
import { MentorProfileView } from "@/components/mentors/mentor-profile-view";
import { apiBaseUrl } from "@/lib/api/client";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import type { Mentor } from "@/lib/domain/types";

/** Metadata is rendered on the server, so it reads the API directly. */
async function lookupMentor(slug: string): Promise<Mentor | null> {
  const base = apiBaseUrl();
  if (!base) return SEED_MENTOR_PROFILES.find((m) => m.slug === slug) ?? null;
  try {
    const response = await fetch(`${base}/mentors/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    return response.ok ? ((await response.json()) as Mentor) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/mentors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const mentor = await lookupMentor(slug);
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
