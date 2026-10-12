import { UniversityMark } from "@/components/mentors/university-mark";

// Universities mentors are joining from; shown even before their first
// mentor is approved.
const COMING = [
  "Stanford University",
  "UC Berkeley",
  "Georgia Tech",
  "University of Pennsylvania",
  "Brown University",
];

// How each university is known in conversation. Anything not here uses the
// short name in brackets on the profile, or the full name.
const SHORT: Record<string, string> = {
  "Stanford University": "Stanford",
  "University of Cambridge": "Cambridge",
  "University of Toronto": "UofT",
  "University of Auckland": "UoA",
  "University of Melbourne": "Melbourne",
  "ETH Zürich": "ETH",
  "National University of Singapore": "NUS",
  "University of Otago": "Otago",
  "Victoria University of Wellington": "VUW",
  "University of Canterbury": "UC",
  "University of Oxford": "Oxford",
  "Imperial College London": "Imperial",
  "University of Sydney": "USYD",
  "UNSW Sydney": "UNSW",
  "Harvard University": "Harvard",
  "UC Berkeley": "Berkeley",
  "University of British Columbia": "UBC",
  "University of Southern California": "USC",
  "London School of Economics": "LSE",
  "Georgia Tech": "Georgia Tech",
  "University of Pennsylvania": "UPenn",
  "Brown University": "Brown",
};

function short(name: string) {
  const [, base, bracketed] = name.match(/^(.*?)\s*(?:\((.*)\))?$/) ?? [];
  return SHORT[base ?? name] ?? bracketed ?? name;
}

/**
 * A slow ribbon of the universities in the group. Pure CSS: the list is
 * drawn twice and slid by half its width, so the loop never shows a seam.
 * Pauses under the pointer; stands still under reduced motion.
 */
export function UniversityMarquee({
  universities,
}: {
  universities: string[];
}) {
  const names = [...new Set([...universities, ...COMING])];
  const row = (hidden: boolean) =>
    names.map((name) => (
      <li
        key={name}
        aria-hidden={hidden || undefined}
        className="flex shrink-0 flex-col items-center gap-2 whitespace-nowrap"
      >
        <UniversityMark university={name} className="h-10 w-auto" />
        <span className="text-xs font-medium text-muted-foreground">
          {short(name)}
        </span>
      </li>
    ));
  return (
    <div
      aria-label="Universities in the group"
      className="relative left-1/2 mt-10 w-screen -translate-x-1/2 overflow-hidden bg-[var(--sheet)] py-5 shadow-sheet [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)] lg:mt-14"
    >
      <ul className="marquee flex w-max gap-12 pl-12 hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </ul>
    </div>
  );
}
