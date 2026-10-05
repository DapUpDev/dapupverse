import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { authAppearance } from "@/app/auth-appearance";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your free DapUp student account.",
};

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app/profile?setup=onboarding"
        appearance={authAppearance}
      />
    </main>
  );
}
