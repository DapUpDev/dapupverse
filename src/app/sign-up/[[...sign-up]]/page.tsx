import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { TechLabel } from "@/components/brand/tech-label";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your free DapUp student account.",
};

export default function SignUpPage() {
  return (
    <main className="grid-lines flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <TechLabel aria-hidden="true">ACCESS / CREATE ACCOUNT</TechLabel>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Join DapUp
          </h1>
          <p className="text-sm text-muted-foreground">
            Every new account starts as a student. Mentors are selected and
            promoted by the DapUp team.
          </p>
        </div>
        <SignUp
          signInUrl="/sign-in"
          fallbackRedirectUrl="/app/profile?setup=onboarding"
        />
      </div>
    </main>
  );
}
