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
  "metadata": "{{user.public_metadata}}",
  "email": "{{user.primary_email_address}}"
}
```

The Next.js app falls back to reading `publicMetadata` directly, so it
works before this is configured — the claim just makes it faster. The
**API** does not have that fallback (it holds no Clerk secret): it reads
roles and the email from these two claims, and a token without them is
treated as a student with no admin capability and no known email. Set the
claims on **both** instances (development and production).

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

## 8. Webhook for deleted accounts (Configure → Webhooks)

Clerk owns the accounts; our database owns everything else. Every API call
refreshes the caller's `users` row, but a person who deletes their Clerk
account never calls again, so Clerk has to tell us. This is the one route
without a session token: Clerk signs each delivery instead, and the API
checks the signature.

Production instance only (the development instance has nothing to clean up):

1. Clerk dashboard → **Configure → Webhooks → Add endpoint**.
2. Endpoint URL: `https://api.dapup.space/webhooks/clerk`.
3. Subscribe to **`user.deleted`** only. Other events are acknowledged and
   ignored.
4. Create it, then open **Signing secret** and copy the `whsec_…` value.
5. Put it in Secrets Manager (never in a file or a PR):

   ```bash
   aws secretsmanager put-secret-value --secret-id dapup/prod/clerk-webhook --secret-string "whsec_PASTE_HERE"
   ```

6. Restart the API tasks so they pick it up (`aws ecs update-service --cluster dapup-prod --service dapup-prod-api --force-new-deployment`), or just wait for the next deploy.
7. Test: in the endpoint's **Testing** tab send an example `user.deleted`.
   Expect `200 {"handled": true, "removed": false}` (the example id does not
   exist). The API logs one line per delivery under `dapup.webhooks`.

What a real deletion does: the `users` row goes, and the database cascades
the mentor or student profile, requests, threads, messages, and read
receipts; the profile picture is deleted from S3. The other person in a chat
loses that history too (decided 2026-09-12: simplest and honest).
