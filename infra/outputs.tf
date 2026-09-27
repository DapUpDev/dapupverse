output "ecr_repository_url" {
  value = data.aws_ecr_repository.api.repository_url
}

# Records the operator must create in Vercel DNS (dapup.space zone).
output "dns_records_to_add" {
  value = {
    certificate_validation = {
      type  = local.acm_validation.resource_record_type
      name  = local.acm_validation.resource_record_name
      value = local.acm_validation.resource_record_value
    }
    api_hostname = {
      type  = "CNAME"
      name  = var.api_domain
      value = aws_lb.api.dns_name
    }
  }
}

# The exact `sub` claim the deploy role trusts; compare against a failing
# run's token if STS ever answers "Not authorized".
output "github_oidc_subject" {
  value = var.github_oidc_subject
}

output "jobs_queue_url" {
  description = "Drop a message here (aws sqs send-message) and watch it appear in the worker's logs."
  value       = aws_sqs_queue.jobs.url
}
