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

# GitHub's "immutable subject" OIDC setting (on for this repo) embeds the
# numeric owner and repository IDs in the token's `sub` claim. IDs survive
# renames and transfers, so a trust policy keyed on them cannot be hijacked
# by someone re-creating a deleted repo under the same name.
# Read them with: gh api repos/DapUpDev/dapupverse --jq '{owner:.owner.id,repo:.id}'
variable "github_oidc_subject" {
  description = "The only OIDC `sub` claim allowed to assume the deploy role: this repo (by immutable IDs), this branch."
  type        = string
  default     = "repo:DapUpDev@257909192/dapupverse@1346767279:ref:refs/heads/main"
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

variable "ses_region" {
  description = "Region of the SES identity used for notification emails (verified in us-east-2, not the stack's region)."
  type        = string
  default     = "us-east-2"
}

variable "ses_identity" {
  description = "Verified SES domain identity the API sends from."
  type        = string
  default     = "dapup.space"
}

variable "email_from" {
  description = "From header for notification emails; the address must belong to var.ses_identity."
  type        = string
  default     = "DapUp <no-reply@dapup.space>"
}

variable "app_base_url" {
  description = "Public site origin used for links inside emails."
  type        = string
  default     = "https://www.dapup.space"
}

variable "worker_desired_count" {
  description = "Queue workers to keep running. 0 parks the worker (jobs wait on the queue, up to 14 days)."
  type        = number
  default     = 1
}

variable "worker_cpu" {
  type    = number
  default = 256
}

variable "worker_memory" {
  type    = number
  default = 512
}

variable "weekly_schedule" {
  description = "EventBridge Scheduler cron for the weekly job (UTC). Default: Mondays 09:00."
  type        = string
  default     = "cron(0 9 ? * MON *)"
}

variable "weekly_schedule_enabled" {
  type    = bool
  default = true
}

variable "llm_provider" {
  description = "Which model provider the worker calls (see llm.tf): deepseek (default), anthropic, or bedrock."
  type        = string
  default     = "deepseek"

  validation {
    condition     = contains(["deepseek", "anthropic", "bedrock"], var.llm_provider)
    error_message = "llm_provider must be one of: deepseek, anthropic, bedrock."
  }
}

variable "llm_model" {
  description = <<-EOT
    Model name passed to the worker as LLM_MODEL, as-is. An empty string
    means "use the provider's default": deepseek -> deepseek-v4-pro,
    anthropic -> claude-opus-5, bedrock -> us.anthropic.claude-opus-5.
    Change it together with llm_provider; a DeepSeek model name means
    nothing to Bedrock and vice versa.
  EOT
  type        = string
  default     = "deepseek-v4-pro"

  # Catches the easy mistake: flipping llm_provider and leaving the DeepSeek
  # model name behind. The worker would then fail every call with
  # "model not found", and only as a warning in its log.
  validation {
    condition = var.llm_model == "" || (
      var.llm_provider == "deepseek" ? startswith(var.llm_model, "deepseek") :
      var.llm_provider == "anthropic" ? startswith(var.llm_model, "claude") :
      can(regex("anthropic\\.", var.llm_model))
    )
    error_message = "llm_model does not look like a model for llm_provider; set it together with the provider, or to \"\" for the provider default."
  }
}
