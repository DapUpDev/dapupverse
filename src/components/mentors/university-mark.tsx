"use client";

/**
 * A small university mark beside the name. Loaded from Google's favicon
 * service so no logo files are stored here; the mark is only ever shown
 * next to the written name, to identify where a mentor studied. Hidden if
 * the university is unknown or the icon fails to load.
 */
// ponytail: a name-to-domain map. Store the domain on the mentor when the
// API has a field for it.
const DOMAINS: Record<string, string> = {
  "Stanford University": "stanford.edu",
  "University of Cambridge": "cam.ac.uk",
  "University of Toronto": "utoronto.ca",
  "University of Auckland": "auckland.ac.nz",
  MIT: "mit.edu",
  "University of Melbourne": "unimelb.edu.au",
  "ETH Z�rich": "ethz.ch",
  "National University of Singapore": "nus.edu.sg",
  "University of Otago": "otago.ac.nz",
  "Victoria University of Wellington": "wgtn.ac.nz",
  "University of Canterbury": "canterbury.ac.nz",
  "University of Oxford": "ox.ac.uk",
  "Imperial College London": "imperial.ac.uk",
  "University of Sydney": "sydney.edu.au",
  "UNSW Sydney": "unsw.edu.au",
  "Harvard University": "harvard.edu",
  "UC Berkeley": "berkeley.edu",
  "University of British Columbia": "ubc.ca",
  "University of Southern California": "/universities/usc.png",
  "London School of Economics": "/universities/lse.png",
};

export function UniversityMark({ university }: { university: string }) {
  // "London School of Economics (LSE)" matches without its bracketed short name.
  const domain =
    DOMAINS[university] ?? DOMAINS[university.replace(/\s*\(.*\)$/, "")];
  if (!domain) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny third-party icon, not an asset of ours
    <img
      src={
        domain.startsWith("/")
          ? domain
          : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      }
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="mr-1.5 inline-block size-4 rounded-[3px] align-[-3px]"
      onError={(e) => (e.currentTarget.hidden = true)}
    />
  );
}
