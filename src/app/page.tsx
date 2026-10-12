import { StateChip } from "@/components/connections/mentor-requests-inbox";
import { HomeDesk } from "@/components/home/hero-desk";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

/* Each step is one line and one small drawn scene, in the app's own parts. */
const STEPS: [string, React.ReactNode][] = [
  [
    "Filter by school, subject or help.",
    <span key="find" className="flex flex-wrap justify-center gap-2 text-sm">
      {["IB", "essay review", "any university"].map((w) => (
        <span
          key={w}
          className="rounded-[4px] bg-mark px-2 py-0.5 leading-[1.3]"
        >
          {w}
        </span>
      ))}
    </span>,
  ],
  [
    "One request. Pending until they accept.",
    <span
      key="ask"
      className="flex items-center gap-3 rounded-[6px] bg-muted px-4 py-3 text-sm"
    >
      <ProfileAvatar name="Sunny" avatarUrl={null} className="size-9" />
      <span className="font-medium">Essay review</span>
      <StateChip state="pending">Pending</StateChip>
    </span>,
  ],
  [
    "Connected. Message them directly.",
    <span key="chat" className="flex flex-col items-center gap-3 text-sm">
      <span className="flex -space-x-3">
        <ProfileAvatar
          name="You"
          avatarUrl={null}
          className="size-11 ring-2 ring-white"
        />
        <ProfileAvatar
          name="Sunny"
          avatarUrl={null}
          className="size-11 ring-2 ring-white"
        />
      </span>
      <StateChip state="accepted">Connected</StateChip>
    </span>,
  ],
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-6 lg:px-10">
      <HomeDesk />

      <section
        aria-labelledby="how-heading"
        className="bleed bg-[var(--block-warm)] py-24 lg:py-32"
      >
        <h2
          id="how-heading"
          className="mx-auto max-w-7xl px-4 font-display text-[clamp(1.9rem,2.4vw+1rem,3rem)] leading-[1.05] font-[450] tracking-[-0.025em] sm:px-6 lg:px-10"
        >
          How DapUp works
        </h2>
        <ol className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-10">
          {STEPS.map(([line, scene], i) => (
            <li key={i} className="sheet p-6 sm:p-7">
              <p className="font-display text-sm font-medium tracking-[0.08em] text-subtle uppercase">
                Step {i + 1}
              </p>
              <p className="mt-1.5 font-medium">{line}</p>
              <div
                aria-hidden="true"
                className="mt-6 flex h-28 items-center justify-center"
              >
                {scene}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="mission-heading"
        id="mission"
        className="bleed scroll-mt-24 bg-[var(--block-dark)] py-24 text-white lg:py-32"
      >
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-10">
          <h2
            id="mission-heading"
            className="font-display text-[clamp(1.9rem,2.4vw+1rem,3rem)] leading-[1.05] font-[450] tracking-[-0.025em]"
          >
            Why us?
          </h2>
          <div className="mt-7 space-y-4 text-lg text-pretty text-white/70">
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
            <p className="font-display text-xl font-semibold text-white">
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
