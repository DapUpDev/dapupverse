# DapUp API (FastAPI)

Runs on ECS Fargate behind `https://api.dapup.space`; see `infra/README.md`
for the infrastructure and the deploy pipeline.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness for Docker, ECS, and the load balancer. Reports the running build. |
| `GET /me` | Clerk session token | Returns the verified caller's `user_id` and `session_id`. The proof that authentication works. |

## Authentication

The frontend sends Clerk's session token as `Authorization: Bearer <token>`.
The API verifies it itself (`app/auth.py`): signature against the Clerk
instance's public keys (JWKS), expiry, issuer, and the browser origin the
token was minted for. No Clerk secret key exists in the API; only public
keys are involved, so a compromised API cannot mint tokens.

Configuration is two environment variables, both non-secret:

| Variable | Production value | Notes |
| --- | --- | --- |
| `CLERK_ISSUER` | `https://clerk.dapup.space` | The instance's frontend API origin. Development instances look like `https://<slug>.clerk.accounts.dev`. Set by Terraform (`var.clerk_issuer`). |
| `CLERK_AUTHORIZED_PARTIES` | defaults to `CORS_ALLOWED_ORIGINS` | Origins a browser token may come from. |

Rejections are always `401 Not authenticated` with `WWW-Authenticate: Bearer`.
The reason (expired, wrong issuer, wrong origin, bad signature) is logged,
never returned, so a caller learns nothing from probing.

## Local development

```bash
cd api
uv sync
uv run pytest
CLERK_ISSUER=https://<slug>.clerk.accounts.dev CORS_ALLOWED_ORIGINS=http://localhost:3000 uv run uvicorn app.main:app --reload
```

Get a token from a signed-in browser tab on the frontend (`await window.Clerk.session.getToken()`)
and call `curl -H "Authorization: Bearer <token>" http://localhost:8000/me`.
Tokens expire after 60 seconds by default.
