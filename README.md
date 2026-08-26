# DapUp

DapUp is a mentor-discovery and connection platform. Students discover mentors, maintain a student profile, send connection requests, and message connected mentors. Mentors maintain a mentor profile, accept or reject student requests, and message students.

This repository is the **clean Next.js replacement for the previous WeWeb frontend**. The old WeWeb code export is reference material only: it must remain outside version control and must never be committed, imported, or copied into this codebase.

## Status: Milestone 1 — frontend scaffold

This repository currently contains only the verified application foundation:

- Next.js (App Router) with strict TypeScript and a `src/` directory
- Tailwind CSS v4
- shadcn/ui (initialized with `components.json`, CSS variables, and the `@/*` import alias)
- ESLint

Intentionally **not** included yet:

- **Authentication** — [Clerk](https://clerk.com) will be integrated in a later milestone, isolated behind a dedicated auth module.
- **Backend persistence** — the permanent database and backend will be selected later; future data access will sit behind typed service/repository boundaries.

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

Run all three before committing; all must pass:

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm run build      # production build
```

## Deploying to Vercel

Do **not** deploy with the Vercel CLI. Import the GitHub repository through the Vercel dashboard:

1. Push this repository to GitHub.
2. In the Vercel dashboard (DapUp's Vercel account), click **Add New… → Project**.
3. Select **Import Git Repository** and choose this repository.
4. Vercel auto-detects Next.js; keep the default framework preset, build command (`next build`), and output settings.
5. Add **no environment variables** — none are required for milestone 1.
6. Click **Deploy**.

Never commit the local `.vercel/` directory (it is ignored).

## Architecture

See [docs/architecture.md](docs/architecture.md) for the planned route structure, the role model (student/mentor account types vs. admin capability), and the planned auth and data-access boundaries.
