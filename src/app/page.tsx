import { ButtonLink } from "@/components/ui/button-link";
import { SectionHeading } from "@/components/brand/section-heading";
import { TechLabel } from "@/components/brand/tech-label";
import { MentorCard } from "@/components/mentors/mentor-card";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import { toPublicMentor } from "@/lib/repositories/mock";

const HOW_IT_WORKS = [
  {
    index: "01",
    title: "Discover mentors",
    description:
      "Browse a selected group of successful students by subject, education system, and university.",
  },
  {
    index: "02",
    title: "Send a request",
    description:
      "Tell a mentor what you need — an essay review, application advice, or subject help.",
  },
  {
    index: "03",
    title: "Connect and message",
    description:
      "Once a mentor accepts, message them directly and plan your next steps together.",
  },
] as const;

export default function HomePage() {
  const featuredMentors = SEED_MENTOR_PROFILES.slice(0, 4).map(toPublicMentor);

  return (
    <main className="flex flex-col">
      {/* Hero — the strongest expression of the identity. */}
      <section className="grid-lines grain relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[-10%] hidden w-3/5 border-l border-border bg-gradient-to-bl from-fog/40 via-secondary/35 to-transparent lg:block"
          style={{ clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 100%)" }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20 sm:py-28">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TechLabel aria-hidden="true">
              DAPUP / MENTORSHIP NETWORK
            </TechLabel>
            <TechLabel aria-hidden="true" className="hidden sm:block">
              FOR STUDENTS — BY STUDENTS
            </TechLabel>
            <TechLabel aria-hidden="true">[ 01 ]</TechLabel>
          </div>

          <h1
            className="animate-rise max-w-4xl font-display font-extrabold tracking-tight"
            style={{
              fontSize: "clamp(2.5rem, 7.5vw, 5.25rem)",
              lineHeight: 1.02,
            }}
          >
            Learn from students
            <br />
            who&rsquo;ve{" "}
            <span className="chrome-text">already made it.</span>
          </h1>

          <p
            className="animate-rise max-w-xl text-lg text-muted-foreground"
            style={{ animationDelay: "180ms" }}
          >
            DapUp connects you with mentors who sat the same exams, wrote the
            same applications, and got into the places you&rsquo;re aiming
            for.
          </p>

          <div
            className="animate-rise flex flex-wrap items-center gap-5"
            style={{ animationDelay: "280ms" }}
          >
            <ButtonLink size="lg" href="/mentors" className="h-11 px-6 text-base">
              Find a mentor
            </ButtonLink>
            <span aria-hidden="true" className="tech-label text-chrome">
              {"///"}
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Every mentor is selected and approved — not an open marketplace.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="flex items-center gap-4 pt-6"
          >
            <div className="h-px flex-1 bg-gradient-to-r from-chrome/70 via-border to-transparent" />
            <TechLabel>SCROLL ↓</TechLabel>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works-heading" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <SectionHeading
            id="how-it-works-heading"
            index="02"
            label="PROCESS"
          >
            How DapUp works
          </SectionHeading>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <li
                key={step.title}
                className={
                  step.index === "02" ? "sm:translate-y-6" : undefined
                }
              >
                <div className="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-6">
                  <span
                    aria-hidden="true"
                    className="font-mono text-3xl font-medium text-fog"
                  >
                    {step.index}
                  </span>
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  <span aria-hidden="true" className="tech-label mt-auto">
                    ››
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured mentors */}
      <section aria-labelledby="featured-heading" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading id="featured-heading" index="03" label="DIRECTORY">
              Featured mentors
            </SectionHeading>
            <ButtonLink variant="outline" href="/mentors">
              Browse all mentors
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredMentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>
        </div>
      </section>

      {/* Selected-network explainer */}
      <section aria-labelledby="network-heading" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex flex-col gap-4 rounded-lg bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <TechLabel aria-hidden="true" className="text-fog">
                SELECTED NETWORK
              </TechLabel>
              <h2
                id="network-heading"
                className="font-display text-xl font-bold tracking-tight"
              >
                A small, approved group — not a marketplace.
              </h2>
              <p className="max-w-xl text-sm text-primary-foreground/75">
                Every DapUp mentor is reviewed and approved before they appear
                in the directory, so the advice you get comes from students
                who have genuinely done it.
              </p>
            </div>
            <ButtonLink
              href="/mentors"
              className="shrink-0 bg-background text-foreground hover:bg-background/85"
            >
              Meet the mentors
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Founding mission */}
      <section
        aria-labelledby="mission-heading"
        id="mission"
        className="grid-lines relative"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-20">
          <TechLabel aria-hidden="true" className="mb-3">
            04 / ORIGIN
          </TechLabel>
          <h2
            id="mission-heading"
            className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Our Founding Mission...
          </h2>
          <div className="mt-8 space-y-4 border-l border-border pl-6 text-muted-foreground">
            <p>
              We were once students who were just like you - unsure,
              overwhelmed, desperate to know the next steps.
            </p>
            <p>
              As a way to give back, we made DapUp, where successful students
              who&rsquo;ve actually done it can be your model for success.
            </p>
            <p>
              It&rsquo;s time to ditch expensive, useless organizations who
              don&rsquo;t care.
            </p>
            <p>Realize your dreams with our team.</p>
            <p className="font-display text-lg font-bold text-foreground">
              DapUp!
            </p>
            <p>For students. By students. Truly.</p>
            <p>
              Yours sincerely,
              <br />
              The DapUp Team
              <br />
              Sunny, Sean, and Raymond
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
