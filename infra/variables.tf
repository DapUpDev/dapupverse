variable "project" {
  description = "Project name used as a resource-name prefix."
  type        = string
  default     = "dapup"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "image_tag" {
  description = <<-EOT
    ECR image tag (Git commit SHA) to deploy. Ownership contract:
    - Set it only for the initial bootstrap deployment (Stage 2).
    - Leave it null afterwards: Terraform then reads the image that is
      currently deployed (registered by the GitHub Actions pipeline) and
      carries it forward, so a Terraform apply can never roll back a
      pipeline deployment.
  EOT
  type        = string
  default     = null
}

variable "container_port" {
  type    = number
  default = 8000
}

variable "task_cpu" {
  description = "Fargate CPU units (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "api_domain" {
  description = "Public hostname for the API (Stage 3)."
  type        = string
  default     = "api.dapup.space"
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed to call the API (the production frontend)."
  type        = list(string)
  default     = ["https://www.dapup.space", "https://dapup.space"]
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "enable_https" {
  description = <<-EOT
    Stage 3 switch. false: ALB serves plain HTTP for verification while the
    ACM certificate awaits DNS validation. true (after the validation CNAME
    exists in Vercel DNS): validate the certificate, add the 443 listener,
    and turn port 80 into a redirect to HTTPS.
    Default is true (steady state since Stage 3b); set false only when
    bootstrapping a new environment before its DNS records exist.
  EOT
  type        = bool
  default     = true
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the deploy role."
  type        = string
  default     = "DapUpDev/dapupverse"
}

# GitHub's "immutable subject" OIDC setting (on for this repo) embeds the
# numeric owner and repository IDs in the token's `sub` claim, e.g.
#   repo:DapUpDev@257909192/dapupverse@1346767279:ref:refs/heads/main
# IDs survive renames and transfers, so a trust policy keyed on them cannot
# be hijacked by someone re-creating a deleted repo under the same name.
# Read them with: gh api repos/DapUpDev/dapupverse --jq '{owner:.owner.id,repo:.id}'
variable "github_owner_id" {
  description = "Numeric GitHub ID of the repository owner (org/user)."
  type        = number
  default     = 257909192
}

variable "github_repo_id" {
  description = "Numeric GitHub ID of the repository."
  type        = number
  default     = 1346767279
}

variable "github_branch" {
  description = "The only branch whose workflow runs may deploy."
  type        = string
  default     = "main"
}

variable "az_count" {
  description = "Zones the load balancer and tasks span. 2 is the ALB minimum; each zone adds a billed public IPv4 address."
  type        = number
  default     = 2
}

variable "clerk_issuer" {
  description = "Clerk instance the API trusts (its frontend API origin). Public keys only; no secret."
  type        = string
  default     = "https://clerk.dapup.space"
}

variable "cors_allowed_origin_regex" {
  description = "Extra browser origins allowed by pattern: Vercel preview deployments (public reads only)."
  type        = string
  default     = "^https://[a-z0-9-]+[.]vercel[.]app$"
}
