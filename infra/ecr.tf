# Registry is owned by infra/foundation; this stack only reads it.
data "aws_ecr_repository" "api" {
  name = "${var.project}-api"
}
