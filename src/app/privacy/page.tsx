import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DapUp collects, uses and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <article className="sheet mx-auto max-w-[40rem] space-y-10 p-7 leading-7 text-pretty shadow-sheet sm:p-12 md:p-16">
        <header className="space-y-4 border-b pb-8">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="text-sm text-subtle">Effective Date: 01 October 2026</p>
          <p className="text-muted-foreground">
            At DapUp (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;),
            your privacy matters. This policy explains what personal information
            we collect when you use our website (the &ldquo;Site&rdquo;), how we
            use it, who can see it and how we protect it. By using DapUp you
            agree to this policy.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Information we collect</h2>

          <p className="text-muted-foreground">
            When you create an account or use DapUp, you may give us:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Your name and email address</li>
            <li>Whether you are a student or a mentor</li>
            <li>Your education system, university, course and year of study</li>
            <li>A profile photo and a short bio</li>
            <li>
              Requests you send to mentors, and the messages you exchange with
              them
            </li>
          </ul>

          <p className="text-muted-foreground">
            When you use the site, we also record ordinary technical information
            such as your IP address, browser, device type, when you signed in
            and which pages you used.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            2. How we use your information
          </h2>

          <p className="text-muted-foreground">We use this information to:</p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Show your profile to students and mentors so you can find each
              other
            </li>
            <li>
              Deliver connection requests and messages between you and your
              mentor or student
            </li>
            <li>
              Review and approve mentor profiles before they appear in the
              directory
            </li>
            <li>Keep the site working, safe and free of spam and abuse</li>
            <li>Answer your questions when you contact us</li>
          </ul>

          <p className="text-muted-foreground">
            We do not sell your personal information.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            3. Who can see your information
          </h2>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Other members can see your public profile: your name, photo, bio,
              university and the help you offer or need.
            </li>
            <li>
              A mentor or student you are connected with can see your requests
              and the messages you send them.
            </li>
            <li>
              The DapUp team can see your information when needed to run the
              site, approve mentors, respond to reports or enforce our terms.
            </li>
            <li>
              Our service providers (sign-in, hosting, file storage and email)
              process your information on our behalf and only to provide those
              services.
            </li>
            <li>
              We may share information with authorities if the law requires it.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Your rights</h2>

          <p className="text-muted-foreground">You can:</p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Ask for a copy of the personal information we hold about you
            </li>
            <li>Ask us to correct or delete it</li>
            <li>Delete your account at any time</li>
          </ul>

          <p className="text-muted-foreground">
            Email us at{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>{" "}
            and we will respond within a reasonable time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. How long we keep it</h2>

          <p className="text-muted-foreground">
            We keep your information while your account is active and for as
            long as we need it to run the site or meet legal requirements. When
            you delete your account we delete your profile, and you can ask us
            to remove anything that remains.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Security</h2>

          <p className="text-muted-foreground">
            We take reasonable steps to protect your information:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Information is stored with reputable hosting providers and access
              is limited to the people who need it
            </li>
            <li>
              Sign-in is handled by a dedicated authentication service, and
              sessions expire
            </li>
            <li>Mentor profiles are reviewed before they are shown publicly</li>
          </ul>

          <p className="text-muted-foreground">
            No website is completely secure, so please use a strong password and
            tell us if you notice anything unusual.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Cookies</h2>

          <p className="text-muted-foreground">
            We use cookies that keep you signed in and that help the site work.
            You can block or delete cookies in your browser, but you may not be
            able to sign in without them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Changes to this policy</h2>

          <p className="text-muted-foreground">
            We may update this policy when the site changes or the law requires
            it. The effective date at the top shows the latest version, and we
            will tell you on the site about significant changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Contact us</h2>

          <p className="text-muted-foreground">
            If you have any questions about your privacy, email us at{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
