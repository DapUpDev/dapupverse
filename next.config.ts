import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixed application facts baked into every build so deployments don't
  // depend on remembering them as Vercel environment variables. Clerk's
  // catch-all <SignIn/>/<SignUp/> components need these to resolve their own
  // routes; only the two Clerk API keys remain deployment configuration.
  env: {
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  },
};

export default nextConfig;
