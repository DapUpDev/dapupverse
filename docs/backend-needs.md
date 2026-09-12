# What DapUp's backend needs, and which AWS piece provides it

Derived from the code on `main` (commit `201ec8a`) plus the Lantr engineering
proposal. Two tiers throughout:

- **Tier 1 — required by the code as it exists.** The repository interfaces in
  `src/lib/repositories/types.ts`, the domain model in `src/lib/domain/types.ts`,
  and the business rules in `src/lib/repositories/mock.ts` define these. Today
  they run against browser-local mock data; the backend must replace that.
- **Tier 2 — required by the proposal's roadmap, not in code yet.** Student
  progress core, RAG, weekly check-in triage, and scheduling (proposal steps
  3–5). Listed so the Tier 1 design does not paint us into a corner.

Already running: FastAPI on ECS Fargate behind an ALB at `api.dapup.space`,
deployed by GitHub Actions (see `infra/README.md`). Everything below plugs
into that.

## 1. Tables

**AWS piece: Amazon RDS for PostgreSQL** (one instance, `db.t4g.micro` to
start, not publicly accessible, reachable only from the ECS task security
group). Schema managed by versioned migrations (Alembic) run as a pre-deploy
step. Automated backups on. The `pgvector` extension is enabled on the same
instance later for Tier 2, so structured data and vectors share one database
and one backup.

### Tier 1

| Table | Columns (essentials) | Rules the code enforces today, now enforced by the database |
| --- | --- | --- |
| `users` | `id` (Clerk user id, PK), `email`, `account_type` enum(`student`,`mentor`), `is_admin` bool, `created_at`, `updated_at` | Mirror of Clerk. Roles are set in the Clerk Dashboard (`publicMetadata`) and synced by webhook. Admin is a capability column, never inferred from `account_type`. |
| `mentor_profiles` | `user_id` PK/FK, `slug` unique, `name`, `university`, `major`, `country_region`, `biography`, `services` enum[], `subjects` text[], `education_systems` enum[], `private_price_usd` numeric(8,2), `avatar_key` (S3), timestamps | Public listing excludes rows with empty `name`. `private_price_usd` is returned only to the mentor, a student with an **accepted** connection, or an admin. That check lives in the API, never the frontend. |
| `student_profiles` | `user_id` PK/FK, `full_name`, `school`, `year_level`, `education_system` enum nullable, `subjects` text[], `biography`, `avatar_key`, timestamps | "Complete" = `full_name`, `school`, `year_level`, `education_system` all set. Required before a request can be sent. |
| `connection_requests` | `id` uuid, `mentor_id` FK, `student_id` FK, `purpose` enum(4 values), `message` text (20–600 chars check), `state` enum(`pending`,`accepted`,`disconnected`,`blocked`), `archived_by_mentor` bool, `created_at`, `updated_at` | Partial unique index on (`student_id`,`mentor_id`) where `state in ('pending','accepted')` replaces `DuplicateRequestError`. A `blocked` row for the pair forbids new requests (`BlockedPairError`). No rejected state exists. Archive only flips `archived_by_mentor`; the student still sees `pending`. |
| `message_threads` | `id` uuid, `connection_id` FK unique, `mentor_id`, `student_id`, `created_at` | Created in the same transaction that accepts a request. One thread per connection. |
| `thread_reads` | (`thread_id`,`user_id`) PK, `last_read_at` | Replaces the `lastReadAt` map. Unread count = messages after `last_read_at` not sent by the user. |
| `messages` | `id` uuid, `thread_id` FK, `sender_id` FK, `text`, `sent_at` | Index (`thread_id`,`sent_at`). Insert allowed only while the connection is `accepted`; otherwise the thread is read-only. |

Directory search (`filterMentors`): free-text substring over name, university,
major, subjects plus exact filters. Postgres `ILIKE` with a `pg_trgm` GIN
index is enough at DapUp's scale. No search service.

### Tier 2 (proposal steps 3–5)

| Table | Purpose |
| --- | --- |
| `goals`, `milestones`, `tasks` | Work the student is expected to complete, with deadlines. |
| `check_ins` | Weekly progress, blockers, confidence, requested help. |
| `meetings`, `mentor_notes` | Human decisions and context. |
| `student_state` | Derived current status the triage agent reads. |
| `interventions`, `agent_runs` | AI decision, evidence, outcome. `agent_runs.event_id` unique = idempotency for retries. |
| `documents`, `document_chunks` | RAG corpus metadata and chunks; `embedding vector(1024)` via pgvector, always filtered by `student_id`. |
| `mentor_availability`, `bookings` | Scheduling inputs and the created calendar blocks. |

## 2. File storage

**AWS piece: Amazon S3**, one private bucket, versioning on, public access
blocked, server-side encryption. The API hands the browser a presigned PUT URL
to upload and a presigned GET URL to view. The ECS task role gets
`s3:PutObject`/`GetObject` on this bucket only. No access keys anywhere.

| Need | Source in code | Key layout | Notes |
| --- | --- | --- | --- |
| Profile avatars, student and mentor | `image-placeholder-field.tsx`: preview only today, "real image storage arrives with the backend" | `avatars/{user_id}/{uuid}.{ext}` | Validate type and size at presign time. Resize and strip EXIF in a background job (below). Optionally CloudFront in front for cached public avatars. |
| Student documents for RAG (Tier 2) | Proposal step 4 | `students/{student_id}/{doc_id}` | Prefix-per-student makes the access rule a bucket-policy condition, not just app code. S3 event notification triggers ingestion. |

## 3. Background jobs

**AWS pieces: Amazon SQS** (one queue per job type, each with a dead-letter
queue) consumed by a **second ECS Fargate service** running the same image
with a worker command, plus **Amazon EventBridge** as the event bus that fans
domain events out to queues. Idempotency keys stored in Postgres so a retried
message never causes a duplicate side effect.

| Job | Trigger | Why it is not inline | AWS piece |
| --- | --- | --- | --- |
| Sync Clerk users into `users` | Clerk webhook `user.created/updated/deleted` hits the API | Webhook must answer fast and be retry-safe; enqueue, then apply | API endpoint + SQS |
| Email notifications: new request, request accepted, new message | Domain events from the API | Email latency and failures must not block the request | EventBridge → SQS → worker → **Amazon SES** (identity `dapup.space`, already verified in us-east-2; production access request pending) |
| Avatar processing (resize, EXIF strip) | S3 `ObjectCreated` on `avatars/` | CPU work off the request path | S3 event → SQS → worker |
| One-off: migrate the old Supabase records and files | Manual | ~7 active students today; run once, verify, cut over | ECS one-off task |
| RAG ingestion: chunk, embed, store (Tier 2) | S3 upload or record change | Slow, retryable, model-bound | SQS → worker → Bedrock → pgvector |
| Check-in triage: retrieve, reason, decide, schedule, brief (Tier 2) | Check-in submitted | Target under 10 s end-to-end but never in the HTTP request | SQS → LangGraph worker → Bedrock → RDS → scheduler |

## 4. Scheduled work

**AWS piece: Amazon EventBridge Scheduler** (cron expressions with time zones)
targeting an SQS queue or `ecs:RunTask`.

| Schedule | Status | What runs |
| --- | --- | --- |
| None required by Tier 1 code | — | Requests never expire and messages never auto-delete, by design. |
| Weekly check-in cycle (Tier 2) | Proposal step 5 | Send the check-in via SES, per student, in their time zone. |
| Reminder to students who have not answered (Tier 2) | Implied | Same path, a few days later. |
| Weekly mentor brief digest (Tier 2) | Proposal step 5 | Summarise changes since last interaction. |
| Already automated by AWS | Live | ACM certificate renewal, RDS backups, ECR image expiry (keep 20), log retention (30 days). |

## 5. Model calls

**AWS piece: Amazon Bedrock**, invoked with the ECS task role
(`bedrock:InvokeModel` on the chosen model ARNs). No API keys. Vectors live in
pgvector on RDS, not a separate vector service.

| Call | Status | Model shape | Guardrails |
| --- | --- | --- | --- |
| None | **Tier 1 code makes zero model calls.** | — | — |
| Embeddings for RAG chunks and queries | Tier 2 | Text embedding model (e.g. Titan Text Embeddings v2, 1024 dims) | Retrieval always filtered by `student_id`; evaluation set checks 0 cross-student hits |
| Triage decision | Tier 2 | Claude on Bedrock via LangGraph, structured output: `NO_MEETING` or 15/30/45/60 min + reason + blocker summary + agenda | Validate JSON against a schema; 60 min hard cap; store every run in `agent_runs` with inputs, retrieved sources, and cost |
| Mentor brief and post-meeting task extraction | Tier 2 | Same model | Human approves before tasks are written |

Log latency, token counts, and per-run cost to CloudWatch for every call.

## 6. Secrets and configuration

Rule: secrets live in **AWS Secrets Manager** and reach the container through
the task definition's `secrets` block (`valueFrom` ARN). The execution role
gets `secretsmanager:GetSecretValue` on those ARNs only. Non-secret config is
plain task-definition environment (Terraform) or **SSM Parameter Store**. AWS
services are called with the **task role**, so most integrations need no
secret at all. Terraform creates the secret container; the value is set
out-of-band so it never lands in Terraform state.

| Item | Secret? | Where | Used for |
| --- | --- | --- | --- |
| RDS master password | Yes | Secrets Manager, RDS-managed with rotation (`manage_master_user_password`) | Migrations, break-glass |
| App database credentials | Preferably none | IAM database authentication with the task role; else a Secrets Manager secret | Every query |
| Clerk JWKS / issuer URL | No | Env | FastAPI verifies the session JWT on every request; this is how the API knows who is calling |
| `CLERK_SECRET_KEY` | Yes | Secrets Manager | Only if the API calls Clerk's Backend API (e.g. reading `publicMetadata` on webhook replay) |
| Clerk webhook signing secret | Yes | Secrets Manager | Verify webhook signatures |
| S3 bucket name, SQS queue URLs, SES sender address and region, Bedrock model IDs | No | Env from Terraform outputs | Wiring |
| `CORS_ALLOWED_ORIGINS`, `APP_VERSION`, log level | No | Env (already in place) | Runtime behaviour |
| Calendar integration credentials (Tier 2) | Yes | Secrets Manager | Creating meeting blocks |
| Frontend: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_BASE_URL` | Mixed | Vercel environment variables | Unchanged |
| GitHub Actions, Terraform | None | OIDC role; local IAM user with MFA | Already keyless |

## Cross-cutting

- **Authentication of API calls**: the frontend sends Clerk's session JWT; FastAPI verifies it against Clerk's JWKS and reads `account_type`/`is_admin` from `users`, not from the token, so role changes take effect immediately.
- **Authorization lives in the API**: price visibility, thread membership, request state transitions. The frontend's guards remain presentation only, exactly as `docs/authentication.md` says.
- **Networking**: RDS gets its own security group that accepts 5432 only from the ECS task security group, the same group-to-group pattern the ALB uses.
- **Observability**: CloudWatch logs (exists), plus alarms on ALB 5xx, task count, queue depth, and DLQ non-empty. Structured JSON logs with `request_id` and `user_id`.
- **Rough incremental cost**: RDS `db.t4g.micro` ~$13/mo, Secrets Manager ~$0.40 per secret/mo, S3 and SQS and EventBridge under $1/mo at this scale, second Fargate service ~$9/mo, Bedrock per token.

## Build order

1. RDS + migrations + `users` sync from Clerk. The API can then answer "who are you" from its own database.
2. Tier 1 tables and endpoints behind the existing repository interfaces; swap `src/lib/repositories/index.ts` to HTTP adapters.
3. S3 avatars.
4. SQS worker service + SES notifications.
5. Tier 2 in the proposal's order: progress core, RAG, triage, scheduling.

## Monthly cost estimate

Unit prices from the AWS Price List API for `us-west-2` (the machine-readable
form of the public pricing pages) on 2026-09-11, except where noted. 730
hours per month. Usage assumptions are for DapUp's current scale: about 7
active students, a dozen mentors, a few thousand requests a day.

### Running today

| Item | Unit price | Assumed usage | Month |
| --- | --- | --- | --- |
| ALB hours | $0.0225/h | 730 h | $16.43 |
| ALB capacity units | $0.008/LCU-h | ~0.1 LCU average | $0.60 |
| Fargate API task, 0.25 vCPU + 0.5 GB | $0.04048/vCPU-h, $0.004445/GB-h | 730 h | $9.01 |
| Public IPv4 addresses | $0.005/h each | 4 on the ALB + 1 on the task | $18.25 |
| CloudWatch logs and Container Insights | $0.50/GB ingested over 5 GB free; 10 metrics and 10 alarms free | ~1 GB, under free tier | $0.00 |
| ECR image storage | $0.10/GB-month | up to 20 images, ~1.2 GB | $0.12 |
| SES dedicated IP (managed) | $15.00/month | subscription, optional | $15.00 |
| SES outbound email | $0.10 per 1,000 | 1,000 emails | $0.10 |
| S3 Terraform state | $0.023/GB-month | < 1 MB | $0.01 |
| **Subtotal** | | | **$59.52** |

Cost Explorer's current run rate is about $2.20 a day, which agrees with this.

### Tier 1 additions (needed by the code as it exists)

| Item | Unit price | Assumed usage | Month |
| --- | --- | --- | --- |
| RDS PostgreSQL `db.t4g.micro`, Single-AZ | $0.016/h | 730 h | $11.68 |
| RDS gp3 storage | $0.115/GB-month | 20 GB | $2.30 |
| RDS backups | free up to the database size, then $0.095/GB-month | within free | $0.00 |
| Fargate worker service, 0.25 vCPU + 0.5 GB | as above | 730 h | $9.01 |
| Public IPv4 for the worker task | $0.005/h | 730 h | $3.65 |
| S3 avatars | $0.023/GB-month + $0.005 per 1,000 PUTs | 5 GB, a few thousand requests | $0.17 |
| SQS | $0.40 per million requests, first million free | < 1 M | $0.00 to $0.40 |
| EventBridge bus | $1.00 per million events | ~10 k events | $0.01 |
| Secrets Manager | $0.40 per secret-month + $0.05 per 10 k calls | 3 secrets | $1.25 |
| CloudWatch alarms and logs | $0.10 per alarm metric over 10 free; logs as above | 5 alarms, ~2 GB logs | $0.50 headroom |
| **Subtotal** | | | **$28.97** |

### Tier 2 additions (proposal roadmap)

| Item | Unit price | Assumed usage | Month |
| --- | --- | --- | --- |
| Bedrock, triage + mentor brief | Claude Sonnet 5 at $2 / $10 per million input / output tokens (Anthropic's published rate; Bedrock's page and Price List API do not list current Claude models, so verify before relying on it) | 30 triage runs of 15 k in / 1.5 k out, 30 briefs of 8 k in / 1 k out | $2.13 |
| Bedrock, Titan Text Embeddings V2 | $0.00002 per 1,000 tokens | 2 M tokens ingested | $0.04 |
| Retries, evaluation runs | | ~40% headroom | $0.83 |
| S3 student documents | $0.023/GB-month | 20 GB | $0.46 |
| RDS storage growth (pgvector) | $0.115/GB-month | +10 GB | $1.15 |
| Secrets Manager, calendar credentials | $0.40 per secret-month | 1 secret | $0.40 |
| SQS, EventBridge Scheduler | Scheduler: 14 M invocations free | weekly cycle | $0.10 |
| CloudWatch extra logs | as above | ~2 GB | $0.50 headroom |
| **Subtotal** | | | **$5.61** |

### Total and budget

| | Month |
| --- | --- |
| Running today | $59.52 |
| Tier 1 complete | $88.49 |
| Tier 1 + Tier 2 complete | **$94.10** |

Budget: the AWS Budget `dapup monthly cost budget` is set to **$105/month**,
about 10% above the full total, with the existing alerts at 85% actual,
100% actual, and 100% forecast. Two levers if it ever trips: dropping the
SES dedicated IP saves $15, and pinning the ALB to two availability zones
instead of four saves $7.30 in public IPv4 charges.
