resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.service_name}"
  retention_in_days = var.log_retention_days
}
