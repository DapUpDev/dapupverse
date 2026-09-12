data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Only zones that need no opt-in and are available today.
data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(sort(data.aws_availability_zones.available.names), 0, var.az_count)
}
