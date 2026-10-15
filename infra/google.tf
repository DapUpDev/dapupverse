# Google Calendar (backend/app/google_calendar.py): the OAuth client that
# lets people connect their calendars, and the key that encrypts their
# refresh tokens before they reach the database.
#
# Like the DeepSeek key, both secrets are created by hand so their values
# never pass through this repo or its state:
#
#   dapup/prod/google-oauth       JSON {"client_id": "...", "client_secret": "..."}
#                                 from Google Cloud > Clients (Web application,
#                                 redirect URI https://api.dapup.space/google/callback)
#   dapup/prod/google-token-key   a Fernet key (generated locally, never printed)
#
# The API (connect, confirm) and the worker (free/busy after triage) both
# need all three values; the execution role reads them at container start.

data "aws_secretsmanager_secret" "google_oauth" {
  name = "${var.project}/${var.environment}/google-oauth"
}

data "aws_secretsmanager_secret" "google_token_key" {
  name = "${var.project}/${var.environment}/google-token-key"
}

locals {
  google_secrets = [
    { name = "GOOGLE_CLIENT_ID", valueFrom = "${data.aws_secretsmanager_secret.google_oauth.arn}:client_id::" },
    { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${data.aws_secretsmanager_secret.google_oauth.arn}:client_secret::" },
    { name = "GOOGLE_TOKEN_KEY", valueFrom = data.aws_secretsmanager_secret.google_token_key.arn },
  ]
}

data "aws_iam_policy_document" "task_execution_google_secrets" {
  statement {
    sid     = "ReadGoogleSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      data.aws_secretsmanager_secret.google_oauth.arn,
      data.aws_secretsmanager_secret.google_token_key.arn,
    ]
  }
}

resource "aws_iam_role_policy" "task_execution_google_secrets" {
  name   = "read-google-secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_google_secrets.json
}
