import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { Mentor } from "@/lib/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { idPhoto, ProfileAvatar } from "@/components/profile/profile-avatar";
import { cn } from "@/lib/utils";
import { UniversityMark } from "@/components/mentors/university-mark";

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_1fr] gap-2">
      <dt className="text-subtle">{term}</dt>
      <dd className="line-clamp-2">{children}</dd>
    </div>
  );
}

/** A comma-separated list; the values that answered a search are highlighted. */
function Items({ items, marked }: { items: string[]; marked: string[] }) {
  return items.map((item, i) => (
    <Fragment key={item}>
      {i > 0 && ", "}
      {marked.includes(item) ? <mark>{item}</mark> : item}
    </Fragment>
  ));
}

/**
 * Public mentor card. Receives the public `Mentor` type, which contains no
 * pricing — pricing must never appear here. The whole sheet is one link.
 *
 * `primary` fills the "Ask" affordance on the card that should lead, and
 * `marked` highlights the facts that matched a search.
 */
const arrow =
  "absolute top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/55 text-foreground/80 backdrop-blur-md transition-[background-color,color,scale] duration-150 ease-out outline-none after:absolute after:-inset-2 hover:bg-white/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92]";

export function MentorCard({
  mentor,
  primary = false,
  marked = [],
  onStep,
}: {
  mentor: Mentor;
  primary?: boolean;
  marked?: string[];
  /** With `primary`: draws arrows over the photo that step to another mentor. */
  onStep?: (by: 1 | -1) => void;
}) {
  return (
    <article className="sheet relative flex h-full flex-col p-5 transition-[scale] duration-150 ease-out active:scale-[0.985] hover:shadow-sheet has-focus-visible:shadow-sheet has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <div className={cn("flex items-start gap-4", primary && "flex-col")}>
        {primary ? (
          <div className="relative w-full">
            <ProfileAvatar
              name={mentor.name}
              avatarUrl={mentor.avatarUrl}
              // The lead card shows its photo at full width, like a product shot.
              className="aspect-[4/3] h-auto w-full rounded-[4px] [&_[data-slot=avatar-fallback]]:text-5xl"
            />
            {onStep && (
              <>
                <button
                  type="button"
                  aria-label="Previous mentor"
                  className={cn(arrow, "left-2")}
                  onClick={() => onStep(-1)}
                >
                  <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Next mentor"
                  className={cn(arrow, "right-2")}
                  onClick={() => onStep(1)}
                >
                  <ChevronRight className="size-3.5" strokeWidth={1.5} />
                </button>
              </>
            )}
          </div>
        ) : (
          <ProfileAvatar
            name={mentor.name}
            avatarUrl={mentor.avatarUrl}
            className={idPhoto}
          />
        )}
        <div className="min-w-0 pt-0.5">
          <h2 className="font-display text-xl leading-tight font-semibold">
            <Link
              href={`/mentors/${mentor.slug}`}
              className="outline-none after:absolute after:inset-0"
            >
              {mentor.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {mentor.major} · <UniversityMark university={mentor.university} />
            <Items items={[mentor.university]} marked={marked} />
          </p>
        </div>
      </div>
      <dl className="mt-4 mb-5 grid gap-2 text-sm leading-snug">
        {mentor.educationSystems.length > 0 && (
          <Fact term="Studied">
            <Items items={mentor.educationSystems} marked={marked} />
          </Fact>
        )}
        {mentor.services.length > 0 && (
          <Fact term="Helps with">
            <Items items={mentor.services} marked={marked} />
          </Fact>
        )}
        {mentor.subjects.length > 0 && (
          <Fact term="Knows">
            <Items items={mentor.subjects} marked={marked} />
          </Fact>
        )}
      </dl>
      <span
        aria-hidden="true"
        className={cn(
          buttonVariants({ variant: primary ? "default" : "outline" }),
          // Drawn only: the whole card is the link. The glass pane paints
          // above the card's link overlay, so clicks must fall through it.
          "pointer-events-none mt-auto self-start",
        )}
      >
        Ask {mentor.name.split(" ")[0]}
        <ArrowRight />
      </span>
    </article>
  );
}
