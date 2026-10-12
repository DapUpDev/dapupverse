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
        className="flex shrink-0 items-center text-sm whitespace-nowrap text-muted-foreground"
      >
        <UniversityMark university={name} />
        {name}
      </li>
    ));
  return (
    <div
      aria-label="Universities in the group"
      className="-mx-7 mt-8 overflow-hidden sm:-mx-10 lg:-mx-16 [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
    >
      <ul className="marquee flex w-max gap-8 pl-7 sm:pl-10 lg:pl-16 hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </ul>
    </div>
  );
}
