import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { TechLabel } from "@/components/brand/tech-label";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your DapUp account.",
};

export default function SignInPage() {
  return (
    <main className="grid-lines flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <TechLabel aria-hidden="true">ACCESS / SIGN IN</TechLabel>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Students and mentors sign in here.
          </p>
        </div>
        <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/app" />
      </div>
    </main>
  );
}
