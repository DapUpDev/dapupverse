# DapUp API (FastAPI)

Runs on ECS Fargate behind `https://api.dapup.space`; see `infra/README.md`
for the infrastructure and the deploy pipeline.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness for Docker, ECS, and the load balancer. Reports the running build. |
| `GET /ready` | none | Can this task reach the database? For operators; the load balancer keeps using `/health`. |
| `GET /me` | Clerk session token | Upserts the caller into the `users` table and returns the row: `user_id`, `account_type`, `is_admin`, `email`, timestamps. |
| `GET /mentors` | none | Public directory. Filters: `query`, `educationSystem`, `subject`, `countryRegion`, `university`, `serviceType`. Never carries the price. |
| `GET /mentors/{slug}` | none | Public mentor detail. 404 for unknown or unfilled profiles. |
| `GET /mentors/{id}/private` | token; the mentor themself or an admin | The private shape, including `privatePriceUsd`. 403 for anyone else, including for ids that do not exist. |
| `GET /me/mentor-profile` | token; mentor account | The caller's own private profile, 404 before it exists. |
| `PUT /me/mentor-profile` | token; mentor account | Create-if-missing then apply the given fields (partial). An empty body just ensures the row. The slug is minted from the first real name and never changes. |

| `GET`/`PUT /me/student-profile` | token; student account | The caller's own profile; create-if-missing then partial update. |
| `GET /students/{id}/profile` | token | The student themself, an admin, or a mentor that student has sent a request to. |
| `POST /connections` | token; student with a complete profile | Send a request. `409 duplicate_request`, `403 blocked_pair`. |
| `GET /connections`, `GET /connections/{id}`, `GET /connections/active?mentorId=` | token | Mine (either side); one, participants only; my active request to one mentor. |
| `POST /connections/{id}/accept` · `archive` · `unarchive` · `disconnect` · `block` | token | Lifecycle. Accept (addressed mentor) creates the thread; archive is a mentor-only inbox flag; disconnect by either party; block by the mentor. No reject exists. |
| `GET /threads`, `GET /threads/{id}` | token | My conversations; participants only. |
| `GET`/`POST /threads/{id}/messages` | token; participants | History; send (`409 messaging_unavailable` once the connection has ended). |
| `POST /threads/{id}/read`, `GET /threads/{id}/unread` | token; participants | Read receipt; unread count. |
| `POST /me/avatar/upload-url` | token | Presigned S3 PUT URL (5 min) for a JPEG/PNG/WebP up to 5 MB; `415 unsupported_type`, `413 too_large`. The browser uploads straight to S3. |
| `PUT /me/avatar` | token | Confirm `{key}`: must be under `avatars/<my id>/` (`403 not_your_upload`), must exist (`404 upload_missing`), must be a small image (`422 invalid_image`, object deleted). Attaches it to my mentor or student profile and deletes the previous picture. |
| `DELETE /me/avatar` | token | Remove my picture (204). |

Who is a mentor or a student comes from the session token's `metadata`
claim (see Authentication below), so the Clerk Dashboard session-token
setting is a prerequisite for any write.

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
| `STORAGE_BUCKET` | `dapup-prod-student-files-<account>` | S3 bucket for profile pictures (`avatars/<user id>/…`). Unset = avatar routes answer 503 and `avatarUrl` is always null. Set by Terraform from the foundation bucket; the task role may only touch the `avatars/` prefix. |

Rejections are always `401 Not authenticated` with `WWW-Authenticate: Bearer`.
The reason (expired, wrong issuer, wrong origin, bad signature) is logged,
never returned, so a caller learns nothing from probing.

## Database

PostgreSQL on RDS, private, reached from the ECS tasks over the peering
connection (see `infra/foundation/README.md`). Credentials arrive as
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, injected by the
task definition's `secrets` block from Secrets Manager; the API never reads
Secrets Manager itself and holds no AWS credentials for it. `DATABASE_URL`
overrides all five for local work. `DB_SSLMODE` defaults to `require`.

Schema changes are Alembic migrations in `alembic/versions`. They run at
container start (`docker-entrypoint.sh` → `python -m app.migrate`) under a
Postgres advisory lock, so two tasks starting together cannot both migrate.
A failed migration exits the container, the task never becomes healthy, and
the ECS circuit breaker rolls the deployment back.

Roles: the API reads `account_type` and `is_admin` from the session token's
`metadata` claim and the address from its `email` claim. Both come from the
Clerk Dashboard session-token setting in `docs/clerk-setup.md`; without
them every caller is a student with no admin capability and no email.

## Local development

```bash
cd api
uv sync
uv run pytest          # database tests start a temporary PostgreSQL from a local initdb, or use TEST_DATABASE_URL
CLERK_ISSUER=https://<slug>.clerk.accounts.dev CORS_ALLOWED_ORIGINS=http://localhost:3000 DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/dapup?sslmode=disable uv run python -m app.migrate
CLERK_ISSUER=... CORS_ALLOWED_ORIGINS=... DATABASE_URL=... uv run uvicorn app.main:app --reload
```

Get a token from a signed-in browser tab on the frontend (`await window.Clerk.session.getToken()`)
and call `curl -H "Authorization: Bearer <token>" http://localhost:8000/me`.
Tokens expire after 60 seconds by default.
