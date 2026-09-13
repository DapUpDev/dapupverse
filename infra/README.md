# DapUp AWS infrastructure (Terraform)

Region `us-west-2`, account `645674817735`. One root module; files are split
by concern (`network.tf`, `ecr.tf`, `iam.tf`, `ecs.tf`, …). No secrets live
here: everything account-specific is derived from data sources, and the only
runtime configuration (CORS origins, domain) is non-sensitive.

## Bootstrap (once)

Remote state lives in S3 with native locking. Create the bucket before the
first `terraform init`:

```bash
aws s3api create-bucket --bucket dapup-terraform-state-645674817735 \
  --region us-west-2 --create-bucket-configuration LocationConstraint=us-west-2
aws s3api put-bucket-versioning --bucket dapup-terraform-state-645674817735 \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket dapup-terraform-state-645674817735 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## Apply boundaries

Every apply has one purpose. Always run `terraform fmt -check`,
`terraform validate`, and `terraform plan` first.

| # | Purpose | Command |
| --- | --- | --- |
| 1 | Registry `dapup-api` — now owned by `infra/foundation` (adopted via import/removed blocks; this stack reads it through a data source) | `terraform -chdir=infra/foundation apply` |
| — | Build + push the image tagged with the Git SHA (see below) | `docker build/push` |
| 2 | Create everything else and deploy that exact image | `terraform apply -var image_tag=<sha>` |
| 3a | (Stage 3) ALB over plain HTTP + request the ACM certificate; then add the two records from `terraform output dns_records_to_add` in Vercel DNS | `terraform apply` |
| 3b | (Stage 3) Validate the certificate, add the 443 listener, redirect 80→443 | `terraform apply -var enable_https=true` |
| 4 | (Stage 4) GitHub OIDC provider + least-privilege deploy role | `terraform apply` |

### Image push (Stage 2, manual)

```bash
SHA=$(git rev-parse --short=12 HEAD)
REPO=$(terraform -chdir=infra output -raw ecr_repository_url)
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin "${REPO%%/*}"
docker build --platform linux/amd64 -t "$REPO:$SHA" ./api
docker push "$REPO:$SHA"
```

### DNS (Stage 3, manual)

`dapup.space` is hosted at Vercel, not Route 53, so Terraform outputs the two
CNAME records instead of creating them (Vercel → Domains → dapup.space → DNS
Records; enter names relative to the zone, e.g. `api`). ACM abandons an
unvalidated request after **72 hours** (status `VALIDATION_TIMED_OUT`); if
that happens, re-request it with
`terraform apply -replace=aws_acm_certificate.api` — the validation CNAME is
stable per domain and account, so the DNS record does not change. Never
delete the validation record: ACM re-checks it at every renewal.

Vercel also adds CAA records to the zone (`letsencrypt.org`, `pki.goog`,
`sectigo.com`) which forbid every other certificate authority. ACM then fails
immediately with `CAA_ERROR`. Add one more CAA record at the zone apex —
flags `0`, tag `issue`, value `amazon.com` — and re-request the certificate as
above. Leave Vercel's own CAA records alone; they cover the frontend.

## Relationship to infra/foundation

`infra/foundation` owns the shared layer (VPC, RDS, S3, ECR, secrets,
bastion) under its own state key. This stack reads the registry through
`data.aws_ecr_repository.api`; when the ECS service moves into the
foundation VPC it will read subnets, the database secret ARN, and the RDS
security group from the foundation's outputs the same way.

## Image ownership contract (Terraform vs. GitHub Actions)

- `var.image_tag` is set **only** for the bootstrap deployment.
- Afterwards it stays `null`: Terraform reads the image from the latest
  active task-definition revision (whatever the pipeline last deployed) and
  carries it forward. Terraform applies change task *shape* — CPU, memory,
  environment, roles — but never the image, so an apply cannot roll back a
  pipeline deployment. The pipeline changes only the image.

## Deploy pipeline (Stage 4)

`.github/workflows/deploy-api.yml` runs on every push to `main` that touches
`backend/`: unit tests → OIDC assume-role → build `linux/amd64` → push
`dapup-api:<12-char sha>` → register a task-definition revision with only the
image and `APP_VERSION` changed → `UpdateService` and wait for stability →
smoke-test `https://api.dapup.space/health` for the new version.

- No AWS keys in GitHub. The role `dapup-prod-github-deploy` trusts only
  tokens whose subject is exactly `terraform output github_oidc_subject`
  (`repo:DapUpDev@<owner-id>/dapupverse@<repo-id>:ref:refs/heads/main`).
  This repo has GitHub's *immutable subject* OIDC setting on, so the claim
  carries numeric IDs; the name-only form `repo:DapUpDev/dapupverse:...`
  never matches and STS answers "Not authorized to perform
  sts:AssumeRoleWithWebIdentity". Check the repo's setting with
  `gh api repos/DapUpDev/dapupverse/actions/oidc/customization/sub`.
- The role can push to one ECR repository, register task definitions, update
  one service, and pass only the two task roles to ECS. It cannot touch the
  ALB, IAM, networking, or state.
- Terraform sets `track_latest = true` on the task definition, so revisions
  registered by the pipeline are read as current state, not drift; combined
  with the ownership contract below, `terraform plan` stays a no-op after a
  deploy. The workflow copies the current revision's tags forward
  (`--include TAGS`) — the provider's `default_tags` apply to task
  definitions too, and an untagged revision shows up as tag drift.
- Manual redeploy of the current commit: Actions → Deploy API → Run workflow.

## Worker, queue, clock

Three files, one apply: `queue.tf` (SQS job queue + dead-letter queue),
`worker.tf` (second Fargate service, same image, command `python -m app.worker`,
own task role: queue + read-only student files + Anthropic on Bedrock, Fargate
Spot, no public address), `schedule.tf` (EventBridge Scheduler, Mondays 09:00
UTC, drops `{"job":"weekly-checkin"}` on the queue). The worker's task
definition follows the same ownership contract as the API's; the deploy
workflow rolls the worker onto every new image (skipped until the service
exists).

Order for the first rollout: merge the worker PR first (so the image the
service starts from already contains `app/worker.py`), then `terraform apply`.
After that, the usual apply-before-merge order applies again.

Proof:

```bash
aws sqs send-message --queue-url "$(terraform output -raw jobs_queue_url)" --message-body '{"job":"hello","source":"manual"}'
aws logs tail /ecs/dapup-prod-worker --since 5m
aws scheduler get-schedule --name dapup-prod-weekly --query "{state:State,when:ScheduleExpression}"
```

Park the worker (jobs wait on the queue) with `worker_desired_count = 0`.

## Verification

```bash
aws ecs wait services-stable --cluster dapup-prod --services dapup-prod-api
aws ecs describe-services --cluster dapup-prod --services dapup-prod-api \
  --query "services[0].{running:runningCount,desired:desiredCount,events:events[:3].message}"
aws logs tail /ecs/dapup-prod-api --since 10m
```

## Rollback

- Bad image: `terraform apply -var image_tag=<previous-sha>` (or redeploy the
  previous SHA through the pipeline). The deployment circuit breaker also
  auto-rolls-back a deployment whose tasks never become healthy.
- Whole stage: `terraform destroy -target=<resource>` for the offending
  resource, or `terraform destroy` to remove everything this module owns
  (the state bucket is outside the module and survives).
