output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "task_definition_family" {
  value = aws_ecs_task_definition.api.family
}

output "deployed_image" {
  value = local.image
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "api_url" {
  value = "https://${var.api_domain}"
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

# Referenced by .github/workflows/deploy-api.yml (role-to-assume).
output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

# The exact `sub` claim the deploy role trusts; compare against a failing
# run's token if STS ever answers "Not authorized".
output "github_oidc_subject" {
  value = local.github_oidc_subject
}
