data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  name           = "${var.project}-${var.environment}" # dapup-prod
  service_name   = "${local.name}-api"                 # dapup-prod-api
  container_name = "api"
  account_id     = data.aws_caller_identity.current.account_id
}
