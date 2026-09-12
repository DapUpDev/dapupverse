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
- `src/lib/auth` — the authentication boundary (milestone 4). All Clerk
  usage is isolated here: `claims.ts` parses server-managed `publicMetadata`
  with least-privilege fallback, `identity.ts`/`guards.ts` provide
  server-side identity and route enforcement, and `use-auth-identity.ts`
  gives client components a presentation-only identity. See
  docs/authentication.md for the route-access matrix.
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

## Authentication (implemented — Clerk)

Authentication uses **Clerk** (milestone 4), isolated behind
`src/lib/auth/` so the rest of the application depends on DapUp's own
`AuthIdentity` interface, not Clerk's SDK surface. Public signup defaults to
student; mentors and the independent admin capability are granted manually
via server-managed Clerk public metadata (docs/clerk-setup.md). Route access
is server-enforced in layouts/pages via `requireAuth` /
`requireAccountType` / `requireAdmin`.

## Data access

The backend is the FastAPI service in `api/` on AWS (ECS Fargate, RDS
PostgreSQL, see `infra/`). The frontend reaches it only through
`src/lib/api/client.ts`, and only from inside a repository adapter; UI
components never talk HTTP directly.

`src/lib/repositories/index.ts` is the switch. When `NEXT_PUBLIC_API_BASE_URL`
is set (Vercel), a repository is bound to its HTTP adapter; otherwise to the
browser-local mock (local development, unit tests, e2e). Repositories move
one at a time:

| Repository | Binding today |
| --- | --- |
| `mentorRepository` | HTTP (`http-mentor.ts`): directory, detail, the mentor's own profile |
| `studentProfileRepository`, `connectionRepository`, `messageRepository` | browser-local mock, still |

The Clerk session token travels as `Authorization: Bearer` and the API
verifies it itself (`api/README.md`); authorization decisions such as who
may see a mentor's price live in the API, not in the frontend. Supabase is
not part of the architecture.

## WeWeb export

The previous frontend's WeWeb code export is a read-only record of prior screens and behavior. It stays out of this repository (`.gitignore` guards common paths), and its generated runtime, compiled bundles, and any embedded service configuration must never be copied here.
