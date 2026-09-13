# The clock: once a week EventBridge Scheduler drops one message on the job
# queue. Nothing else runs on a timer. The worker treats it like any other
# job, so "weekly check-in" logic lives in the worker, not in the schedule.

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

# The only thing the clock may do: put a message on this one queue.
data "aws_iam_policy_document" "scheduler_enqueue" {
  statement {
    sid       = "EnqueueJobs"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.jobs.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_enqueue" {
  name   = "enqueue-jobs"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_enqueue.json
}

resource "aws_scheduler_schedule" "weekly" {
  name        = "${local.name}-weekly"
  description = "Weekly check-in cycle: enqueue one job for the worker."
  state       = var.weekly_schedule_enabled ? "ENABLED" : "DISABLED"

  schedule_expression          = var.weekly_schedule
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_sqs_queue.jobs.arn
    role_arn = aws_iam_role.scheduler.arn
    # The message body the worker will receive.
    input = jsonencode({ job = "weekly-checkin", source = "schedule" })
  }
}
