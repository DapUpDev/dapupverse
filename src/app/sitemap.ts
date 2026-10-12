import type { MetadataRoute } from "next";
import { mentorRepository } from "@/lib/repositories";

const SITE = "https://www.dapup.space";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ponytail: the API is the only source of mentor slugs; if it is down the
  // sitemap still lists the fixed pages.
  const mentors = await mentorRepository.list().catch(() => []);
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/mentors`, changeFrequency: "weekly", priority: 0.9 },
    ...mentors.map((m) => ({
      url: `${SITE}/mentors/${m.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
