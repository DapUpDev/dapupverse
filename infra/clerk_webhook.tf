# Clerk's webhook signing secret. Clerk signs every webhook delivery with
# it; the API refuses anything that does not verify (see api/app/webhooks.py).
#
# Terraform creates the secret with a placeholder so the task definition can
# reference it and containers keep starting. The real value is pasted in by
# the owner (Clerk dashboard -> Webhooks -> Signing secret) with:
#
#   aws secretsmanager put-secret-value --secret-id dapup/prod/clerk-webhook \
#     --secret-string "whsec_..."
#
# ignore_changes keeps Terraform from putting the placeholder back.

resource "aws_secretsmanager_secret" "clerk_webhook" {
  name        = "${var.project}/${var.environment}/clerk-webhook"
  description = "Svix signing secret for Clerk webhook deliveries to the API"
}

resource "aws_secretsmanager_secret_version" "clerk_webhook" {
  secret_id     = aws_secretsmanager_secret.clerk_webhook.id
  secret_string = "whsec_placeholder-set-me-from-the-clerk-dashboard"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# The EXECUTION role reads it while launching the container, same as the
# database secret; the task role still gets no secret access.
data "aws_iam_policy_document" "task_execution_clerk_webhook" {
  statement {
    sid       = "ReadClerkWebhookSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.clerk_webhook.arn]
  }
}

resource "aws_iam_role_policy" "task_execution_clerk_webhook" {
  name   = "read-clerk-webhook-secret"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_clerk_webhook.json
}
