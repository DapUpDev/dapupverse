# DapUp

DapUp is a mentor-discovery and connection platform. Students discover mentors, maintain a student profile, send connection requests, and message connected mentors. Mentors maintain a mentor profile, accept or reject student requests, and message students.

This repository is the **clean Next.js replacement for the previous WeWeb frontend**. The old WeWeb code export is reference material only: it must remain outside version control and must never be committed, imported, or copied into this codebase.

## Status: Milestone 2 — functional prototype with mock data

The foundation (milestone 1) is Next.js App Router with strict TypeScript, a
`src/` directory, Tailwind CSS v4, shadcn/ui, and ESLint.

Milestone 2 adds the complete frontend information architecture and core user
journeys, running entirely on **typed, browser-local mock data**:

- Public marketing homepage, mentor directory with search/filters, public
  mentor profiles, Terms, and a Privacy route shell
- Connect-with-mentor journey: auth-required dialog (future-auth UI only),
  student profile completion gating with a preserved connection intent,
  request form, and duplicate-request prevention
- Request lifecycle: `pending → accepted`, mentor-side archiving (invisible
  to students — deliberately **no rejected state anywhere**), disconnect, and
  block
- Messaging, unlocked only after acceptance, with read-only ended
  conversations
- Student and mentor profile view/edit; the mentor's price is private
  (visible only to the mentor, connected students, and admins)
- A demo-session module with four preview identities (visitor, student,
  mentor, mentor + admin), available **only in local development and Vercel
  preview deployments** — production shows public pages plus a clear
  "account access isn't enabled yet" notice and no role selector

The demo session is explicitly not authentication or security. It is a
replaceable preview mechanism that Clerk will supplant.

Intentionally **not** included yet:

- **Authentication** — [Clerk](https://clerk.com) will be integrated in a later milestone, isolated behind a dedicated auth module.
- **Backend persistence** — the permanent database and backend will be selected later; the mock repositories in `src/lib/repositories` define the typed boundaries a real backend will implement.
- **Scheduling (Calendly), payments, analytics, CAPTCHA, cookie tooling** — all deferred.
- **The final visual redesign** — milestone 3 reskins the deliberately neutral presentation without touching business logic.

**No environment variables are required for this milestone.** Do not create `.env` files or invent placeholder secrets. When environment variables become necessary, document them in a tracked `.env.example` (permitted by `.gitignore`) and keep real values in untracked `.env.local`.

## Requirements

- Node.js **20.9+** (Node 24 LTS recommended; this scaffold was built and verified with Node 24)
- npm (this repository uses `package-lock.json`; do not introduce other lockfiles)

## Local development

```bash
npm install       # install dependencies
npm run dev       # start the dev server at http://localhost:3000
```

## Quality checks

Run these before committing; all must pass:

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm run test       # Vitest unit/component tests
npm run e2e        # Playwright end-to-end tests (needs: npx playwright install chromium)
npm run build      # production build
```

## Legal copy

The Terms and Conditions page renders copy supplied by the DapUp team, and the
Privacy Policy page is a shell awaiting real copy. **All legal copy requires
owner/legal review before a public launch.** Known inconsistency to resolve:
the terms state an effective date of 01 July 2025 but a copyright year of
2024.

## Deploying to Vercel

Do **not** deploy with the Vercel CLI. Import the GitHub repository through the Vercel dashboard:

1. Push this repository to GitHub.
2. In the Vercel dashboard (DapUp's Vercel account), click **Add New… → Project**.
3. Select **Import Git Repository** and choose this repository.
4. Vercel auto-detects Next.js; keep the default framework preset, build command (`next build`), and output settings.
5. Add **no environment variables** — none are required for milestone 1.
6. Click **Deploy**.

Never commit the local `.vercel/` directory (it is ignored).

## Architecture and design

See [docs/architecture.md](docs/architecture.md) for the planned route structure, the role model (student/mentor account types vs. admin capability), and the planned auth and data-access boundaries.

See [docs/design.md](docs/design.md) for the milestone 3 visual design system: the seven-color palette, semantic token mapping, three-level typography (Syne / Geist / Geist Mono), and page-by-page intensity rules. The temporary text wordmark will be replaced by an owner-supplied logo.
