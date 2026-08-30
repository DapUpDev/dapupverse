import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your DapUp account.",
};

/** Clerk's default prebuilt sign-in experience, unthemed by request. */
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/app" />
    </main>
  );
}
