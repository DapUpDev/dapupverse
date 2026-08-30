# Clerk Dashboard setup (owner runbook)

Code alone cannot configure the Clerk Dashboard. These steps are performed
by the DapUp owner at https://dashboard.clerk.com for application **dapup**
(`app_3IcqSsHazahGliuiAUMPuRDX6yZ`). Never paste the secret key into chat,
commits, or client code.

## 1. Instances

- The **development** instance already exists (`clerk init` wired its keys
  into `.env.local`).
- Before launching on `dapupverse.com`, create the **production** instance
  (Dashboard → your app → "Create production instance") and complete its
  DNS steps for the production domain.

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
- `https://dapupverse.com` and the Vercel production URL (production
  instance)

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
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`

Redeploy after adding them.

## 7. e2e test users (development instance only)

`npm run e2e` upserts three synthetic users
(`dapup-e2e-{student,mentor,admin}+clerk_test@example.com`) with reserved
test phone numbers and signs them in via server-minted sign-in tokens using
the local `CLERK_SECRET_KEY`. They exist only in the development instance
and are safe to delete; the suite recreates them.
