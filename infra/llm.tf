# Which model the worker talks to, and the API key it needs to do so.
#
# The worker has one "ask the model" function (backend/app/llm.py) with three
# providers behind an environment switch: DeepSeek (the default until AWS
# grants Bedrock model access), Anthropic's own API, or Anthropic models on
# Bedrock. var.llm_provider picks one; var.llm_model optionally overrides the
# model name. Both land in the worker's environment in worker.tf.
#
# DeepSeek and Anthropic need an API key. Those live in Secrets Manager and
# reach the container the same way the database password does: the ECS agent
# (execution role) fetches the value at container start and injects it as an
# environment variable inside the container only. Bedrock needs no key at
# all; the worker's task role is already allowed to invoke Anthropic models
# there (see worker.tf).
#
# The secrets are NOT created by Terraform. The owner creates them once, by
# hand, so the key never passes through this repo or its state:
#
#   aws secretsmanager create-secret --name dapup/prod/deepseek-api-key \
#     --secret-string "sk-..."
#
# Terraform then only looks the secret up by name, exactly as database.tf
# does for the database credentials. The Anthropic one is looked up only when
# var.llm_provider is "anthropic", so it need not exist otherwise.

data "aws_secretsmanager_secret" "deepseek_api_key" {
  name = "${var.project}/${var.environment}/deepseek-api-key"
}

data "aws_secretsmanager_secret" "anthropic_api_key" {
  count = var.llm_provider == "anthropic" ? 1 : 0
  name  = "${var.project}/${var.environment}/anthropic-api-key"
}

# The EXECUTION role reads the key(s) while launching the container, same as
# the database secret; the task role (what the worker code runs as) still
# gets no secret access.
data "aws_iam_policy_document" "task_execution_llm_secrets" {
  statement {
    sid     = "ReadLlmSecrets"
    actions = ["secretsmanager:GetSecretValue"]
    resources = concat(
      [data.aws_secretsmanager_secret.deepseek_api_key.arn],
      data.aws_secretsmanager_secret.anthropic_api_key[*].arn,
    )
  }
}

resource "aws_iam_role_policy" "task_execution_llm_secrets" {
  name   = "read-llm-secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_llm_secrets.json
}
