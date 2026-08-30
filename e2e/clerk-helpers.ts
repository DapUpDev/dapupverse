import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient, type ClerkClient } from "@clerk/backend";
import { expect, type Page } from "@playwright/test";
import { TEST_USERS } from "./global-setup";

export type TestRole = keyof typeof TEST_USERS;

let clerkClient: ClerkClient | null = null;

function backend(): ClerkClient {
  if (!clerkClient) {
    clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
  }
  return clerkClient;
}

/**
 * Sign the page's session in as one of the synthetic e2e users.
 *
 * Uses a server-minted sign-in token (ticket strategy) rather than password
 * sign-in, because the development instance's client-trust protection blocks
 * programmatic password sign-ins.
 */
export async function signInAs(page: Page, role: TestRole): Promise<void> {
  const users = await backend().users.getUserList({
    emailAddress: [TEST_USERS[role].email],
  });
  const user = users.data[0];
  if (!user) {
    throw new Error(`e2e user missing for role "${role}" — global setup failed?`);
  }
  const token = await backend().signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 300,
  });

  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({
    page,
    signInParams: { strategy: "ticket", ticket: token.token },
  });
  // Wait until clerk-js has an active user AND the server-readable session
  // cookie exists, so subsequent server-side auth() calls see the session.
  await page.waitForFunction(
    () => {
      const w = window as unknown as { Clerk?: { user?: unknown } };
      return Boolean(w.Clerk?.user);
    },
    null,
    { timeout: 15_000 },
  );
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).some((c) =>
          c.name.startsWith("__session"),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  await page.goto("/");
}

export async function signOut(page: Page): Promise<void> {
  await clerk.signOut({ page });
}
