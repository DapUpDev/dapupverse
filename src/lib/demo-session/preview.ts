/**
 * Server-side decision for whether the demo-session preview tooling (role
 * selector, preview identities) is available.
 *
 * The decision is made on the server and passed to client UI as an explicit
 * boolean. Nothing browser-controlled (query params, localStorage, cookies)
 * can enable it, and it is never treated as security — it only decides
 * whether demo tooling renders.
 */

type PreviewEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

/** Pure decision, exported for tests. */
export function resolvePreviewEnabled(env: PreviewEnv): boolean {
  if (env.NODE_ENV === "development") return true;
  // On Vercel, only preview deployments get demo tooling — never production.
  return env.VERCEL_ENV === "preview";
}

/** Read the decision from the real server environment. */
export function isPreviewEnvironment(): boolean {
  return resolvePreviewEnabled({
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
