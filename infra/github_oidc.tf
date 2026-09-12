# GitHub Actions deploys without any long-lived AWS key. GitHub's OIDC
# provider issues a short-lived signed token per workflow run; AWS STS
# exchanges it for temporary credentials for one role — and only when the
# token was minted for this repository on the production branch.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # AWS validates GitHub's certificate chain against its own trust store, so
  # thumbprints are informational; kept for older-provider compatibility.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aee1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Exact match: this repo (by immutable numeric IDs, see variables.tf),
    # this branch. A fork, a PR, another branch, or a re-created repo with
    # the same name produces a different `sub` and is refused by STS.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_oidc_subject]
    }
  }
}

locals {
  github_owner = split("/", var.github_repo)[0]
  github_name  = split("/", var.github_repo)[1]
  github_oidc_subject = format(
    "repo:%s@%d/%s@%d:ref:refs/heads/%s",
    local.github_owner, var.github_owner_id, local.github_name, var.github_repo_id, var.github_branch,
  )
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${local.name}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600
}

# Least privilege: exactly the calls the workflow makes, on exactly the
# resources it touches. Nothing here can create, delete, or read anything
# outside the API's registry, service, and task definition.
data "aws_iam_policy_document" "github_deploy" {
  # ECR login tokens are account-wide by API design (no resource ARN).
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPushPullApiRepo"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:DescribeImages",
    ]
    resources = [data.aws_ecr_repository.api.arn]
  }

  # Task definitions are not resource-scoped by AWS for Describe/Register;
  # the family is fixed by the workflow and the PassRole guard below limits
  # what a registered definition can run as.
  statement {
    sid = "TaskDefinitions"
    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
    ]
    resources = ["*"]
  }

  # Registering a revision *with tags* additionally needs TagResource, but
  # only as part of that registration — not free-standing tag edits.
  statement {
    sid       = "TagNewTaskDefinitions"
    actions   = ["ecs:TagResource"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "ecs:CreateAction"
      values   = ["RegisterTaskDefinition"]
    }
  }

  statement {
    sid = "UpdateApiService"
    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService",
    ]
    resources = [aws_ecs_service.api.id]
  }

  # Registering a task definition hands its roles to ECS. Only the two
  # roles this module owns may be passed, and only to ECS tasks.
  statement {
    sid     = "PassTaskRoles"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.task_execution.arn,
      aws_iam_role.task.arn,
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy-api"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
