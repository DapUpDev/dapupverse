# The clock: EventBridge Scheduler drops one "checkin-tick" message on the
# job queue every hour. WHEN the weekly check-in goes out is not set here:
# it lives in the database (program_settings, edited on /admin; default
# Thursday 08:00 Pacific) and the worker sends once that time has passed.
# Nothing else runs on a timer. The worker treats it like any other
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
  description = "Check-in tick: the worker sends this week's check-ins once their time has come (set on /admin), then reminds and expires."
  state       = var.weekly_schedule_enabled ? "ENABLED" : "DISABLED"

  schedule_expression          = "cron(0 * * * ? *)" # every hour, on the hour
  schedule_expression_timezone = "UTC"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_sqs_queue.jobs.arn
    role_arn = aws_iam_role.scheduler.arn
    # The message body the worker will receive.
    input = jsonencode({ job = "checkin-tick", source = "schedule" })
  }
}
