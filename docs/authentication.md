# DapUp authentication (milestone 4)

## Pre-migration audit (verified against the checked-out code)

How auth worked before this milestone:

- **There was no real authentication.** Nothing handled sign-in; the
  "Create account" / "Sign in" buttons in the connect dialog were disabled
  placeholders.
- Identity came from `src/lib/demo-session/`: a browser-selectable preview
  role (visitor / student / mentor / mentor+admin) stored in localStorage,
  exposed through `DemoSessionProvider`/`useDemoSession`, and switchable via
  a header `RoleSwitcher`.
- The selector existed only in development and Vercel Preview
  (`isPreviewEnvironment()`); production rendered an "account access isn't
  enabled yet" notice on `/app/**` and `/admin`.
- Route "protection" was preview UI gating (`RequireDemoAccount`,
  client-side `isAdmin` checks) — presentation, not security.
- **The WeWeb-era hosted database was never installed or referenced** anywhere in the codebase
  (verified by grep); it existed only in the old WeWeb export, which is not
  part of this repository.
- Product data was (and still is) deterministic mock data in a
  browser-local store behind typed repository interfaces.

## What replaced it

| Before | After |
| --- | --- |
| `DemoSessionProvider` / `useDemoSession` | Clerk session + `src/lib/auth/` (`getAuthIdentity`, `useAuthIdentity`) |
| `RoleSwitcher` (browser-picked role) | Clerk `UserButton` + server-managed `publicMetadata` roles |
| `RequireDemoAccount` UI gate | Server guards: `requireAuth`, `requireAccountType`, `requireAdmin` |
| `isPreviewEnvironment()` production notice | Real sign-in redirect (`/sign-in?redirect_url=…`) |
| Disabled sign-in/sign-up buttons | `/sign-in` + `/sign-up` routes with Clerk prebuilt components |
| Demo ids (`student-demo`, …) | `dataUserId` = Clerk user id (students) or `mentorProfileId` (mapped mentors) |

## Identity model

```ts
type AuthIdentity = {
  isAuthenticated: boolean;
  clerkUserId: string | null;   // authentication identity
  dataUserId: string | null;    // key into browser-local mock repositories
  accountType: "student" | "mentor" | null;
  capabilities: { isAdmin: boolean };
};
```

Roles live in server-managed Clerk `publicMetadata`, parsed by
`src/lib/auth/claims.ts`:

```ts
type DapUpPublicMetadata = {
  accountType?: "student" | "mentor"; // default student
  capabilities?: { isAdmin?: boolean }; // default false; independent of type
  mentorProfileId?: string; // optional bridge to a seeded mock mentor
};
```

Missing, malformed, or unrecognized metadata always resolves to
`student` + `isAdmin: false`. Users cannot select mentor at signup or
promote themselves; promotion happens in the Clerk Dashboard
(see docs/clerk-setup.md).

## Route access matrix

| Route | Access | Enforced by |
| --- | --- | --- |
| `/`, `/mentors`, `/mentors/[slug]`, `/terms`, `/privacy` | Public | — |
| `/sign-in/**`, `/sign-up/**` | Public | — |
| `/app` | Authenticated; redirects student → `/mentors`, mentor → `/app/requests` | `requireAuth` (page) |
| `/app/profile`, `/app/connections`, `/app/messages`, `/app/messages/[threadId]` | Any authenticated user | `requireAuth` (layout + page) |
| `/app/requests` | Mentor account type only | `requireAccountType("mentor")` |
| `/admin/**` | Explicit `isAdmin` capability only | `requireAdmin` (layout) |
| `/forbidden` | The intentional not-authorized experience | — |

Server guards redirect signed-out users through `/sign-in` with a validated
internal `redirect_url` (`safeInternalPath` prevents open redirects).
Client-side role rendering (navigation, CTAs) is presentation only.

## Data and authorization

In production every repository talks to the DapUp API (`backend/`), which
verifies the Clerk session token itself and enforces authorization: who
may see a mentor's price, who may read a student's profile, who may act
on a connection, who may read a thread. The frontend's guards remain
presentation and routing only.

The browser-local mock is still the binding for local development, unit
tests, and the e2e suite (which deliberately shares one browser's store
between test users to play both sides of a connection). Clearing browser
storage there erases demo data but never touches the Clerk account.
