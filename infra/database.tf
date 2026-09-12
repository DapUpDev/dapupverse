# The database and its credentials are owned by infra/foundation. This stack
# only reads the secret's ARN so the task definition can hand the values to
# the container at start (the `secrets` block in ecs.tf) and the execution
# role may fetch them. The values never appear in this state or in any
# Terraform-managed environment variable.

data "aws_secretsmanager_secret" "db" {
  name = "${var.project}/${var.environment}/postgres"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    sid       = "ReadDatabaseSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [data.aws_secretsmanager_secret.db.arn]
  }
}

# The EXECUTION role fetches the secret while launching the container; the
# task role (what the application code runs as) gets no secret access at
# all, so a compromised app cannot read other secrets in the account.
resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "read-db-secret"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets.json
}
