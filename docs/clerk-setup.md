# Clerk Dashboard setup (owner runbook)

Code alone cannot configure the Clerk Dashboard. These steps are performed
by the DapUp owner at https://dashboard.clerk.com for application **dapup**
(`app_3IcqSsHazahGliuiAUMPuRDX6yZ`). Never paste the secret key into chat,
commits, or client code.

## 1. Instances

- The **development** instance exists (`clerk init` wired its keys into
  `.env.local`); it powers localhost and Vercel Preview deployments.
- The **production** instance is live on `dapup.space` with its own
  `pk_live`/`sk_live` keys. Remember: every setting below is configured
  **per instance** — changes made in Development do not carry over to
  Production, and each instance has its own separate user pool.

## 2. Sign-in methods (User & Authentication → Email, phone, username)

- Enable **Email address** with **Password**.
- Set email verification to **Verification code**.
- Review the **phone number** requirement: the instance currently requires a
  phone number at signup (discovered during testing). If students should
  sign up with email only, make phone optional or disable it.
- Under **SSO connections**, enable **Google** (dev instances use Clerk's
  shared credentials; production requires your own Google OAuth client ID
  and secret — follow the Dashboard's Google connection instructions).
  Apple/GitHub are currently on; disable them if unwanted.

## 3. Allowed origins / redirects

Development keys work for localhost automatically. Add (per instance, as
the Dashboard requests them):

- `http://localhost:3000`
- Your Vercel Preview URLs (`https://*-dapup.vercel.app`)
- `https://dapup.space` (production instance)

## 4. Custom session claim (Sessions → Customize session token)

So server code can read roles without an extra API call, set the session
token claims to:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

The app also falls back to reading `publicMetadata` directly, so nothing
breaks before this is configured — the claim just makes it faster.

## 5. Promoting users (Users → select user → Metadata → Public)

Every new signup is automatically an effective **student** (empty metadata
parses to least privilege). To change someone, edit their **public
metadata** — users can never edit this themselves.

Student (default — no metadata needed, shown for completeness):

```json
{}
```

Promoted mentor:

```json
{ "accountType": "mentor" }
```

Mentor with admin capability (admin is independent — never implied by
mentor):

```json
{ "accountType": "mentor", "capabilities": { "isAdmin": true } }
```

Optional: map a promoted mentor to one of the seeded demo mentor profiles
(so they inherit that mock profile in the browser-local demo data):

```json
{ "accountType": "mentor", "mentorProfileId": "mentor-jae" }
```

Seeded ids: `mentor-jae`, `mentor-mira`, `mentor-tomas`, `mentor-ana`,
`mentor-daniel`, `mentor-hana`, `mentor-lucas`, `mentor-priya`.

After changing metadata, the user may need to refresh or re-authenticate
before a configured session claim reflects the change.

## 6. Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add for
**Production** and **Preview**:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from the matching Clerk instance's
  API keys page (use production-instance keys for Production once created;
  development keys otherwise).
- `CLERK_SECRET_KEY` — same page. Server-only; Vercel keeps it out of the
  client bundle. Never commit it.

These two keys are the only variables a deployment needs — the sign-in/
sign-up route paths are baked into `next.config.ts`, and post-auth
fallback destinations are component props. Redeploy after adding them.

Key/environment pairing:

- **Production** → the production instance's `pk_live` / `sk_live` keys.
  Live keys work only on `dapup.space`; the production deployment's
  `*.vercel.app` alias will not serve working auth, which is expected.
- **Preview** → the development instance's `pk_test` / `sk_test` keys,
  because previews run on `*.vercel.app` domains that the production
  instance does not authorize.

## 7. e2e test users (development instance only)

`npm run e2e` upserts three synthetic users
(`dapup-e2e-{student,mentor,admin}+clerk_test@example.com`) with reserved
test phone numbers and signs them in via server-minted sign-in tokens using
the local `CLERK_SECRET_KEY`. They exist only in the development instance
and are safe to delete; the suite recreates them.
