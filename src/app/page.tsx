import { StateChip } from "@/components/connections/mentor-requests-inbox";
import { HomeDesk } from "@/components/home/hero-desk";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-3 pb-24 sm:px-6 sm:pt-6 lg:px-10">
      <HomeDesk />

      <section aria-labelledby="how-heading" className="pt-14 lg:pt-20">
        <h2 id="how-heading" className="sr-only">
          How DapUp works
        </h2>
        {/* The life of one request, in the chips the app shows it with. */}
        <p className="sheet max-w-3xl p-8 font-display text-[clamp(1.25rem,1vw+1rem,1.625rem)] leading-[1.6] font-medium tracking-[-0.01em] text-pretty sm:p-12">
          Tell a mentor what you need — an essay review, application advice,
          or subject help. Your request stays{" "}
          <StateChip state="pending">Pending</StateChip> until they accept.
          Once you&rsquo;re <StateChip state="accepted">Connected</StateChip>,
          message them directly and plan your next steps together.
        </p>
      </section>

      <section
        aria-labelledby="mission-heading"
        id="mission"
        className="scroll-mt-24 pt-24 lg:pt-32"
      >
        <div className="sheet max-w-2xl p-8 sm:p-12 lg:ml-auto">
          <h2
            id="mission-heading"
            className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl"
          >
            Our Founding Mission...
          </h2>
          <div className="mt-7 space-y-4 text-lg text-pretty text-muted-foreground">
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
            <p className="font-display text-xl font-semibold text-foreground">
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
