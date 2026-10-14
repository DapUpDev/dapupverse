# Notification emails go out through SES from the API itself (a background
# task after the response), so the only infrastructure is permission: the
# task role may send as our verified domain identity, nothing else. The
# domain has a default configuration set attached (made by the SES console
# wizard), and SES checks SendEmail against it too, so it is allowed here. SES
# lives in a different region from the rest of the stack (the identity was
# verified there), hence var.ses_region.

locals {
  ses_send_resources = [
    "arn:aws:ses:${var.ses_region}:${local.account_id}:identity/${var.ses_identity}",
    "arn:aws:ses:${var.ses_region}:${local.account_id}:configuration-set/*",
  ]
}

data "aws_iam_policy_document" "task_email" {
  statement {
    sid       = "SendNotificationEmail"
    actions   = ["ses:SendEmail"]
    resources = local.ses_send_resources
  }
}

resource "aws_iam_role_policy" "task_email" {
  name   = "email"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_email.json
}
