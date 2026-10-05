import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { authAppearance } from "@/app/auth-appearance";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your DapUp account.",
};

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <SignIn
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/app"
        appearance={authAppearance}
      />
    </main>
  );
}
