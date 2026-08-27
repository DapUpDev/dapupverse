# DapUp architecture notes

Updated at milestone 2 (functional prototype with mock data).

## Layering (milestone 2)

- `src/lib/domain` — backend-agnostic domain types and pure logic
  (`filter-mentors`, profile completion). No React, no storage.
- `src/lib/data/seed.ts` — deterministic, fictional seed data for the demo.
- `src/lib/mock/store.ts` — the browser-local mock store (in-memory,
  mirrored to localStorage for demo persistence). Presentational components
  never touch it directly.
- `src/lib/repositories` — the typed repository interfaces
  (`MentorRepository`, `ConnectionRepository`, `MessageRepository`,
  `StudentProfileRepository`) and their mock adapters. A future backend
  replaces the bindings in `index.ts` without changing consumers.
  `useRepositoryQuery` is the one React hook that bridges store changes to
  components.
- `src/lib/demo-session` — the preview-identity module. The server decides
  preview availability (`NODE_ENV === "development"` or
  `VERCEL_ENV === "preview"`) and passes an explicit boolean to the client
  provider; nothing browser-controlled can enable it. Clerk will replace
  this provider in a later milestone behind the same `useDemoSession`-shaped
  consumer surface.
- `src/components` — presentational and journey components, all consuming
  repositories and the demo session only.

## Request lifecycle (deliberate design)

`ConnectionState = "pending" | "accepted" | "disconnected" | "blocked"` —
there is **no rejected state and no reject action anywhere**. Mentors accept
requests or archive them; archiving is mentor-side inbox state
(`archivedByMentor`) that never changes what the student sees. Messaging
threads exist only after acceptance; disconnecting or blocking makes the
thread read-only. Mentor pricing is private: public types (`Mentor`) simply
do not contain the price field.

## Planned routes

Public (no authentication):

| Route | Purpose |
| --- | --- |
| `/` | Marketing homepage |
| `/mentors` | Public mentor directory |
| `/mentors/[slug]` | Public mentor detail |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |

Authenticated (added when Clerk lands):

| Route | Purpose |
| --- | --- |
| `/app` | Role-aware authenticated entry |
| `/app/profile` | Role-aware profile (student or mentor) |
| `/app/connections` | Student connections |
| `/app/requests` | Mentor/admin incoming requests |
| `/app/messages` | Authenticated messaging |
| `/admin` | Admin-only area |

When implemented, these should use App Router route groups (e.g. `(public)` and `(app)`) so shared layouts and access control stay separated.

## Roles

Account type and admin capability are **separate axes**:

- **Account type**: `student` or `mentor`. Determines the primary product experience (discovering mentors vs. receiving requests).
- **Admin**: a capability that can be granted independently. `admin` and `mentor` are **not** the same role, and no code may assume a mentor is an admin or vice versa.

## Authentication (future)

Authentication will use **Clerk**, introduced in a later milestone. Integration must be isolated behind a dedicated auth module (e.g. `src/lib/auth/`) so the rest of the application depends on our own interface, not Clerk's SDK surface. Until then, the app has no auth code at all — no fake sessions, placeholder middleware, or `isAuthenticated` flags.

## Data access (future)

The permanent database/backend is deliberately unselected. When chosen, all data access goes behind typed service/repository boundaries (e.g. `src/lib/services/`), so UI components never talk to a database client or HTTP API directly. Do not reuse anything from the old WeWeb/Supabase setup.

## WeWeb export

The previous frontend's WeWeb code export is a read-only record of prior screens and behavior. It stays out of this repository (`.gitignore` guards common paths), and its generated runtime, compiled bundles, and any embedded service configuration must never be copied here.
