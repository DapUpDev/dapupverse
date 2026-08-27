import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "DapUp Terms and Conditions of Use.",
};

/*
 * NOTE: This legal copy was supplied by the DapUp team and is rendered as
 * provided (whitespace normalized only). It requires owner/legal review
 * before any public launch. Known inconsistencies to review: the effective
 * date says 2025 while the copyright line says 2024.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <article className="space-y-8">
        <header className="space-y-3 border-b border-border pb-6">
          <p aria-hidden="true" className="tech-label">
            LEGAL / 01
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Terms and Conditions
          </h1>
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Effective Date: 01 July 2025
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Ownership of Site; Agreement to Terms of Use
          </h2>
          <p className="text-muted-foreground">
            Welcome to DapUp! A student-first mentorship platform built for
            students by successful students. These Terms and Conditions of Use
            (&ldquo;Terms of Use&rdquo;) apply to the DapUp website located at{" "}
            <a
              href="https://www.dapupverse.com"
              className="font-medium text-foreground underline underline-offset-4"
            >
              www.dapupverse.com
            </a>
            , and all associated pages or services linked to www.dapupverse.com
            by DapUp, its partners, or affiliates (collectively, the
            &ldquo;Site&rdquo;). The Site is the property of DapUp
            (&ldquo;DapUp&rdquo;) and its licensors.
          </p>
          <p className="font-medium">
            BY USING THE SITE, YOU AGREE TO THESE TERMS OF USE. IF YOU DO NOT
            AGREE, DO NOT USE THE SITE.
          </p>
          <p className="text-muted-foreground">
            DapUp reserves the right, at its sole discretion, to change,
            modify, add, or remove portions of these Terms of Use at any time.
            It is your responsibility to review these Terms periodically for
            updates. Your continued use of the Site after changes are posted
            constitutes your acceptance of those changes. As long as you comply
            with these Terms of Use, DapUp grants you a personal,
            non-exclusive, non-transferable, limited right to access and use
            the Site.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Content</h2>
          <p className="text-muted-foreground">
            All text, graphics, user interfaces, visual design, photographs,
            logos, audio, artwork, computer code, and other materials
            (collectively, &ldquo;Content&rdquo;), including but not limited to
            the layout, visual design, structure, coordination, and overall
            &ldquo;look and feel&rdquo; of the Site, are owned, controlled, or
            licensed by or to DapUp, and are protected by copyright, trademark,
            trade dress, and other intellectual property laws.
          </p>
          <p className="text-muted-foreground">
            Except as expressly permitted in these Terms of Use, no part of the
            Site or its Content may be copied, reproduced, republished,
            uploaded, posted, publicly displayed, encoded, translated,
            transmitted, or distributed in any way (including
            &ldquo;mirroring&rdquo;) to any other computer, server, website, or
            medium for publication or commercial use without DapUp&rsquo;s
            prior written permission.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Who Can Join</h2>
          <p className="text-muted-foreground">To use DapUp, you must:</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>Be at least 13 years old</li>
            <li>Be a current student, recent graduate, or verified mentor</li>
            <li>Provide honest, accurate information</li>
            <li>Comply with all applicable laws</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            How to Behave
          </h2>
          <p className="text-muted-foreground">We expect all users to:</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>Act respectfully and professionally</li>
            <li>Avoid spam, harassment, or harmful content</li>
            <li>Not engage in discriminatory, offensive, or illegal behavior</li>
            <li>Use DapUp only for educational and mentorship purposes</li>
          </ul>
          <p className="text-muted-foreground">
            Violation of these standards may result in account suspension or
            removal.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            What We&rsquo;re Not Liable For
          </h2>
          <p className="text-muted-foreground">DapUp does not:</p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>Guarantee the accuracy of any mentorship advice</li>
            <li>
              Take responsibility for any decisions or outcomes based on
              platform interactions
            </li>
            <li>
              Endorse or manage any opportunities discussed outside the
              platform
            </li>
          </ul>
          <p className="text-muted-foreground">
            Use your own judgment when acting on advice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Your Privacy</h2>
          <p className="text-muted-foreground">
            We value your privacy. Highlights:
          </p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>We don&rsquo;t sell your data</li>
            <li>Your messages are stored securely</li>
            <li>You can request deletion of your data at any time</li>
          </ul>
          <p className="text-muted-foreground">
            For full details, see our Privacy Policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Platform Changes
          </h2>
          <p className="text-muted-foreground">
            We may update features, make changes, or temporarily suspend the
            platform without prior notice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Account Deletion
          </h2>
          <p className="text-muted-foreground">
            You can delete your account or request removal at any time. We
            reserve the right to restrict access if you misuse the platform or
            violate these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            No Guarantees
          </h2>
          <p className="text-muted-foreground">
            DapUp is provided &ldquo;as is.&rdquo; We make no guarantees about
            uptime, mentorship quality, or results.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Jurisdiction</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of New Zealand. Any disputes
            will be handled by New Zealand courts.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Contact Us</h2>
          <p className="text-muted-foreground">
            Questions? We&rsquo;re here to help.
          </p>
          <p className="text-muted-foreground">
            Email:{" "}
            <a
              href="mailto:dapup.dev@gmail.com"
              className="font-medium text-foreground underline underline-offset-4"
            >
              dapup.dev@gmail.com
            </a>
          </p>
        </section>

        <p className="border-t pt-6 text-sm text-muted-foreground">
          © 2024 DapUp. All rights reserved.
        </p>
      </article>
    </main>
  );
}
