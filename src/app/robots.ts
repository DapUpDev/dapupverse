import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in areas and admin: nothing for a search engine there.
      disallow: ["/app/", "/admin", "/sign-in", "/sign-up"],
    },
    sitemap: "https://www.dapup.space/sitemap.xml",
  };
}
