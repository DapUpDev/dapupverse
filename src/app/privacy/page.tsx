import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DapUp collects, uses and protects your personal information.",
};

/*
 * Written against the NZ Privacy Act 2020 (IPP 3 notice items, IPP 6/7
 * access and correction, IPP 12 overseas storage, Part 5 complaints,
 * notifiable breaches). The [bracketed] legal name and address in "Who we
 * are" must be filled in by the DapUp team before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="page">
      <article className="sheet mx-auto max-w-[40rem] space-y-10 p-7 leading-7 text-pretty shadow-sheet sm:p-12 md:p-16">
        <header className="space-y-4 border-b pb-8">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="text-sm text-subtle">Effective Date: 01 October 2026</p>
          <p className="text-muted-foreground">
            This page tells you what personal information DapUp collects when
            you use our website (the &ldquo;Site&rdquo;), why we collect it, who
            can see it and how to use your rights under the New Zealand Privacy
            Act 2020.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Who we are</h2>

          <p className="text-muted-foreground">
            DapUp is run by [legal name of the company or the people running
            DapUp], [postal address], New Zealand. We are the agency that
            collects and holds your information under the Privacy Act 2020. Our
            privacy officer can be reached at{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Information we collect</h2>

          <p className="text-muted-foreground">
            To make an account you need to give us your name, your email address
            and whether you are a student or a mentor. Without these we cannot
            create your account.
          </p>

          <p className="text-muted-foreground">Everything else is up to you:</p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Your education system, university, course and year of study</li>
            <li>A profile photo and a short bio</li>
            <li>
              Requests you send to mentors, and the messages you exchange with
              them
            </li>
          </ul>

          <p className="text-muted-foreground">
            Mentors need a complete profile before they appear in the directory,
            and students need one before they can send a request.
          </p>

          <p className="text-muted-foreground">
            Our hosting and sign-in providers also keep standard server logs,
            which include your IP address, browser and device type and when you
            signed in. We do not run analytics that track which pages you visit.
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
              Email mentors when a student sends them a request, and email
              students when a mentor accepts
            </li>
            <li>
              Review and approve mentor profiles before they appear in the
              directory
            </li>
            <li>Keep the site working, safe and free of spam and abuse</li>
            <li>Answer your questions when you contact us</li>
          </ul>

          <p className="text-muted-foreground">
            We do not sell your personal information, and we do not use it for
            advertising.
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
              and the messages you send them. Messages are not end-to-end
              encrypted, so the DapUp team can read them when handling a report.
            </li>
            <li>
              The DapUp team can see your information when needed to run the
              site, approve mentors, respond to reports or enforce our terms.
            </li>
            <li>
              We may share information if the law requires it, or to protect
              someone&rsquo;s safety.
            </li>
          </ul>

          <p className="text-muted-foreground">
            We use other companies to run DapUp. They only process your
            information for us, not for their own purposes:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Clerk handles sign-in (your name, email and password or social
              login)
            </li>
            <li>Vercel hosts the website</li>
            <li>
              Amazon Web Services (AWS) runs our servers, database and photo
              storage, and sends our emails
            </li>
          </ul>

          <p className="text-muted-foreground">
            Some of these companies store information outside New Zealand,
            mainly in Australia and the United States. When that happens we make
            sure they must protect it to a standard comparable to New Zealand
            privacy law. If we ever add a provider that processes your profile
            or messages for a new purpose, we will update this page first.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Your rights</h2>

          <p className="text-muted-foreground">
            Under the Privacy Act 2020 you have the right to:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              Ask for a copy of the personal information we hold about you
            </li>
            <li>
              Ask us to correct it. If we do not agree, you can ask us to attach
              a note saying what you think is right
            </li>
            <li>Delete your account at any time from your profile settings</li>
          </ul>

          <p className="text-muted-foreground">
            Email{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>
            . We will reply within 20 working days and will not charge you. We
            may ask you to confirm it is you first.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. How long we keep it</h2>

          <p className="text-muted-foreground">
            We keep your information while your account is active. When you
            delete your account we delete your profile, photo, requests and
            messages, and the person you were talking to will no longer see the
            conversation either. Copies in backups and technical logs are
            cleared on a rolling basis, normally within a few weeks.
          </p>

          <p className="text-muted-foreground">
            We give your account its own ID so the site works. We do not use
            your school, university or government ID numbers.
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
            <li>Sign-in is handled by Clerk, and sessions expire</li>
            <li>Mentor profiles are reviewed before they are shown publicly</li>
          </ul>

          <p className="text-muted-foreground">
            No website is completely secure, so please use a strong password and
            tell us if you notice anything unusual.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. If something goes wrong</h2>

          <p className="text-muted-foreground">
            If your information is lost, leaked or accessed without permission
            and this could seriously harm you, we will tell you as soon as we
            can, and we will report it to the Office of the Privacy
            Commissioner.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Under 18s</h2>

          <p className="text-muted-foreground">
            You must be at least 13 to use DapUp. If you are under 18, we
            recommend you show this page to a parent or guardian. You have the
            same privacy rights as an adult, and a parent or guardian can help
            you use them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Cookies</h2>

          <p className="text-muted-foreground">
            We and Clerk use cookies to keep you signed in and to help the site
            work. You can block or delete cookies in your browser, but you will
            not be able to sign in without them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">10. Changes to this policy</h2>

          <p className="text-muted-foreground">
            We may update this policy when the site changes or the law requires
            it. The effective date at the top shows the latest version. We will
            email you about significant changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">11. Complaints and contact</h2>

          <p className="text-muted-foreground">
            If you think we have got your privacy wrong, email our privacy
            officer at{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline"
            >
              dapup.dev@gmail.com
            </a>{" "}
            first and we will try to fix it. If you are not happy with our
            answer, you can complain to the Office of the Privacy Commissioner
            at{" "}
            <a
              href="https://www.privacy.org.nz"
              className="font-medium text-foreground underline"
            >
              privacy.org.nz
            </a>{" "}
            or on 0800 803 909.
          </p>
        </section>
      </article>
    </main>
  );
}
