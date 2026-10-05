import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { Mentor } from "@/lib/domain/types";
import { buttonVariants } from "@/components/ui/button";
import { idPhoto, ProfileAvatar } from "@/components/profile/profile-avatar";
import { cn } from "@/lib/utils";

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
export function MentorCard({
  mentor,
  primary = false,
  marked = [],
}: {
  mentor: Mentor;
  primary?: boolean;
  marked?: string[];
}) {
  return (
    <article className="sheet relative flex h-full flex-col p-5 hover:shadow-sheet has-focus-visible:shadow-sheet has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <div className="flex items-start gap-4">
        <ProfileAvatar
          name={mentor.name}
          avatarUrl={mentor.avatarUrl}
          className={idPhoto}
        />
        <div className="min-w-0 pt-0.5">
          <h2 className="font-display text-xl leading-tight font-semibold tracking-tight">
            <Link
              href={`/mentors/${mentor.slug}`}
              className="outline-none after:absolute after:inset-0"
            >
              {mentor.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {mentor.major} ·{" "}
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
          "mt-auto self-start",
        )}
      >
        Ask {mentor.name.split(" ")[0]}
        <ArrowRight />
      </span>
    </article>
  );
}
