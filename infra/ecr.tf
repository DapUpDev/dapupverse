# The registry moved to infra/foundation (it is shared by every service,
# so it belongs in the foundation stack). These `removed` blocks make the
# next apply drop the two resources from THIS stack's state without
# destroying them; infra/foundation/import-ecr.tf adopts them. The data
# source below keeps the rest of this stack reading the same repository.

removed {
  from = aws_ecr_repository.api
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_ecr_lifecycle_policy.api
  lifecycle {
    destroy = false
  }
}

data "aws_ecr_repository" "api" {
  name = "${var.project}-api"
}
