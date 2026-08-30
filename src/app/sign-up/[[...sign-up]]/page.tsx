import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your free DapUp student account.",
};

/** Clerk's default prebuilt sign-up experience, unthemed by request. */
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app/profile?setup=onboarding"
      />
    </main>
  );
}
