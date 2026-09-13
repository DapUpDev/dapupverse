# Notification emails go out through SES from the API itself (a background
# task after the response), so the only infrastructure is permission: the
# task role may send as our verified domain identity, nothing else. SES
# lives in a different region from the rest of the stack (the identity was
# verified there), hence var.ses_region.

data "aws_iam_policy_document" "task_email" {
  statement {
    sid       = "SendNotificationEmail"
    actions   = ["ses:SendEmail"]
    resources = ["arn:aws:ses:${var.ses_region}:${local.account_id}:identity/${var.ses_identity}"]
  }
}

resource "aws_iam_role_policy" "task_email" {
  name   = "email"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_email.json
}
