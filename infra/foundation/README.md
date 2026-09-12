# DapUp foundation (Terraform)

The long-lived, shared layer every service builds on: network, database,
file storage, container registry, database credentials, and an
administrative way in. Region `us-west-2`, account `645674817735`.

## Why a second root module

`infra/` (the API stack: ECS service, load balancer, deploy pipeline) and
`infra/foundation/` have different lifecycles and different blast radii. A
mistake in a service stack should never be able to destroy the database.
Keeping them as separate root modules with separate state keys makes that
a property of the tooling, not of care. Service stacks read what they need
from the foundation's outputs.

## What it creates

| Resource | Purpose | Cost/month, approx. |
| --- | --- | --- |
| VPC `10.20.0.0/16`, 2 public + 2 private subnets, internet gateway | Public tier for things that face the internet, private tier for the database. No NAT gateway, on purpose. | $0 |
| RDS PostgreSQL 18, `db.t4g.micro`, 20 GB gp3, single-AZ, encrypted, 7-day backups | The one database. Not publicly accessible; only named security groups may reach 5432. | $14 |
| Secrets Manager secret `dapup/prod/postgres` | Master credentials as JSON (`host`, `port`, `dbname`, `username`, `password`). | $0.40 |
| S3 bucket `dapup-prod-student-files-<account>` | Avatars and student documents. Versioned, encrypted, public access blocked, TLS-only, CORS for presigned uploads. | under $1 |
| ECR repository `dapup-api` (adopted, see below) | The registry the API pipeline pushes to. | under $1 |
| VPC peering to the default VPC | The running API reaches the database without moving; its task security group is allowed in by reference. | $0 |
| Bastion: `t4g.nano` Amazon Linux 2023, no inbound rules, no SSH key, Session Manager only, **stopped by default** | Reach the private database from a laptop through an SSM tunnel. | $0.64 stopped; $6.70 while running |

About $15/month at rest. Everything is `learning_mode = true` by default; see
the table below.

## Why peer instead of moving the API

The API stack lives in the default VPC. Moving it here would recreate the
load balancer (new DNS name, Vercel record change, cutover) for no benefit
at this scale. A same-region peering connection has no hourly charge and
lets the API's task security group be referenced directly in the database
rules, so no IP ranges appear anywhere. If the API is ever rebuilt inside
this VPC, set `peer_with_default_vpc = false` and pass its subnets instead.

## Prerequisites

- The Terraform state bucket already exists (created for `infra/`).
- Session Manager plugin for the AWS CLI, once per laptop:

```bash
winget install --id Amazon.SessionManagerPlugin
```

## Apply order (first time)

The registry `dapup-api` is currently tracked by the API stack. Adoption is
two declarative, no-destroy steps.

1. **API stack first.** `infra/ecr.tf` now contains `removed` blocks and a
   data source. The plan says the two ECR resources "will no longer be
   managed"; nothing is destroyed.

   ```bash
   terraform -chdir=infra plan
   terraform -chdir=infra apply
   ```

2. **Foundation.** The plan shows 2 to import and roughly 30 to add.

   ```bash
   terraform -chdir=infra/foundation init
   terraform -chdir=infra/foundation plan
   terraform -chdir=infra/foundation apply
   ```

   RDS takes 5 to 10 minutes to create.

3. **Delete `import-ecr.tf`** and commit (done 2026-09-12). The adoption is
   complete; leaving the file would break a future destroy-and-re-apply.
   Steps 1 and 2 are history now: a fresh checkout applies with plain
   `terraform apply` and owns the registry outright.

## Connecting to the database

Never through a public address. The bastion is stopped between sessions;
start it, open an SSM tunnel through it to the database, and stop it when
done. Its instance id never changes, so the tunnel command stays valid.

```bash
terraform -chdir=infra/foundation apply -var bastion_state=running
```

Wait about a minute for the SSM agent to register, then:

```bash
terraform -chdir=infra/foundation output -raw db_port_forward_command
```

Run the printed command in one terminal and leave it open. In another:

```bash
psql "host=localhost port=15432 dbname=dapup user=dapup_admin sslmode=require"
```

The password is in Secrets Manager. To use it without printing it, let
`psql` read it from the environment:

```powershell
$env:PGPASSWORD = (aws secretsmanager get-secret-value --secret-id dapup/prod/postgres --query SecretString --output text | ConvertFrom-Json).password
```

For a shell on the bastion itself:

```bash
aws ssm start-session --target <bastion_instance_id>
```

(`sudo dnf install -y postgresql17` there if you want `psql` on the box.)

When finished:

```bash
terraform -chdir=infra/foundation apply
```

which returns the bastion to `stopped`, the default. Starting it with the
EC2 console or CLI works too, but the next apply will stop it again, which
is the intended safety net.

Who can open a session is governed by IAM (`ssm:StartSession` on the
instance), not by network rules, and every session is logged by Systems
Manager.

## Learning mode

| Setting | `learning_mode = true` (now) | `learning_mode = false` (production) |
| --- | --- | --- |
| Secret deletion | immediate | 30-day recovery window |
| ECR repository deletion | forced, images included | refused while images exist |
| S3 bucket deletion | forced, objects included | refused while objects exist |
| RDS deletion | no final snapshot, no deletion protection | final snapshot, deletion protection on |
| RDS changes | applied immediately | applied in the maintenance window |

Destroy and re-apply:

```bash
terraform -chdir=infra/foundation destroy
terraform -chdir=infra/foundation apply
```

Caveat: destroying the foundation force-deletes `dapup-api`, images
included. The running API task keeps running (its image is already pulled),
but the next deploy needs an image: after re-apply, run the Deploy API
workflow by hand (Actions → Deploy API → Run workflow) to push one.

## Production hardening, when the time comes

- `learning_mode = false`.
- `manage_master_user_password = true` on the instance, and drop
  `random_password` + the secret version, so the password never enters
  Terraform state and rotates automatically.
- `multi_az = true` once downtime during maintenance matters.
- Move the bastion to a private subnet behind SSM interface endpoints, or
  set `bastion_enabled = false` between administrative sessions.
- VPC flow logs to CloudWatch for the private subnets.
- Bound `db_max_allocated_storage_gb` (50 GB today) is a cost cap; raise it
  deliberately when data grows.
