# DapUp architecture notes

Recorded at milestone 1 (frontend scaffold). These are intentions, not implemented features; do not create empty directories ahead of the milestone that needs them.

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
