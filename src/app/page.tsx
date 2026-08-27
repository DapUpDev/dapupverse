import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MentorCard } from "@/components/mentors/mentor-card";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import { toPublicMentor } from "@/lib/repositories/mock";

const HOW_IT_WORKS = [
  {
    title: "Discover mentors",
    description:
      "Browse a selected group of successful students by subject, education system, and university.",
  },
  {
    title: "Send a request",
    description:
      "Tell a mentor what you need — an essay review, application advice, or subject help.",
  },
  {
    title: "Connect and message",
    description:
      "Once a mentor accepts, message them directly and plan your next steps together.",
  },
] as const;

export default function HomePage() {
  const featuredMentors = SEED_MENTOR_PROFILES.slice(0, 4).map(toPublicMentor);

  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Learn from students who&apos;ve already made it.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            DapUp connects you with mentors who sat the same exams, wrote the
            same applications, and got into the places you&apos;re aiming for.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink size="lg" href="/mentors">
              Find a mentor
            </ButtonLink>
            <p className="text-sm text-muted-foreground">
              Every mentor is selected and approved — not an open marketplace.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works-heading" className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            How DapUp works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardHeader>
                    <p
                      aria-hidden="true"
                      className="text-sm font-semibold text-muted-foreground"
                    >
                      {index + 1}
                    </p>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured mentors */}
      <section aria-labelledby="featured-heading" className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2
              id="featured-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              Featured mentors
            </h2>
            <ButtonLink variant="ghost" href="/mentors">
              Browse all mentors
            </ButtonLink>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredMentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>
        </div>
      </section>

      {/* Founding mission */}
      <section aria-labelledby="mission-heading" id="mission">
        <div className="mx-auto w-full max-w-3xl px-4 py-16">
          <h2
            id="mission-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Our Founding Mission...
          </h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              We were once students who were just like you - unsure,
              overwhelmed, desperate to know the next steps.
            </p>
            <p>
              As a way to give back, we made DapUp, where successful students
              who&apos;ve actually done it can be your model for success.
            </p>
            <p>
              It&apos;s time to ditch expensive, useless organizations who
              don&apos;t care.
            </p>
            <p>Realize your dreams with our team.</p>
            <p className="font-medium text-foreground">DapUp!</p>
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
