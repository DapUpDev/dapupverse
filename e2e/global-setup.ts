/**
 * Playwright global setup for Clerk-backed e2e tests.
 *
 * Uses the local development-instance keys (never committed) to upsert three
 * dedicated synthetic test users and configure Clerk testing tokens. The
 * password is generated per run and passed to workers via the environment —
 * no real accounts or secrets are hard-coded.
 */

import { randomBytes } from "node:crypto";
import { clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";

export type TestUserFixture = {
  email: string;
  /** Clerk reserved test phone number (the instance requires phone at signup). */
  phone: string;
  publicMetadata: Record<string, unknown>;
};

export const TEST_USERS: Record<"student" | "mentor" | "admin", TestUserFixture> =
  {
    student: {
      email: "dapup-e2e-student+clerk_test@example.com",
      phone: "+15555550101",
      publicMetadata: {},
    },
    mentor: {
      email: "dapup-e2e-mentor+clerk_test@example.com",
      phone: "+15555550102",
      publicMetadata: { accountType: "mentor", mentorProfileId: "mentor-jae" },
    },
    admin: {
      email: "dapup-e2e-admin+clerk_test@example.com",
      phone: "+15555550103",
      publicMetadata: {
        accountType: "mentor",
        capabilities: { isAdmin: true },
        mentorProfileId: "mentor-mira",
      },
    },
  };

export default async function globalSetup() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local may be absent in CI; keys must then come from the env.
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is not available. Clerk-backed e2e tests need the development-instance keys in .env.local (run `clerk init`).",
    );
  }

  await clerkSetup();

  const password = `DapE2e!${randomBytes(12).toString("hex")}`;
  process.env.E2E_USER_PASSWORD = password;

  const clerkClient = createClerkClient({ secretKey });

  for (const fixture of Object.values(TEST_USERS)) {
    const existing = await clerkClient.users.getUserList({
      emailAddress: [fixture.email],
    });
    if (existing.data.length > 0) {
      const user = existing.data[0];
      await clerkClient.users.updateUser(user.id, {
        password,
        publicMetadata: fixture.publicMetadata,
        skipPasswordChecks: true,
      });
    } else {
      await clerkClient.users.createUser({
        emailAddress: [fixture.email],
        phoneNumber: [fixture.phone],
        password,
        publicMetadata: fixture.publicMetadata,
        skipPasswordChecks: true,
      });
    }
  }
}
