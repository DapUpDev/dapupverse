# The job queue: a to-do list between "something happened" and "a worker
# handles it". Producers (the API, the weekly schedule) drop a small JSON
# message on it and move on; the worker service picks messages up whenever
# it is ready. If the worker is down, messages simply wait (up to 14 days).
#
# A message that fails five times in a row moves to the dead-letter queue
# instead of being retried forever, so one bad job cannot jam the line.

resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.name}-jobs-dlq"
  message_retention_seconds = 14 * 24 * 3600
}

resource "aws_sqs_queue" "jobs" {
  name = "${local.name}-jobs"

  # A picked-up message is hidden from other workers for this long; if the
  # worker dies before deleting it, it reappears and is retried.
  visibility_timeout_seconds = 300
  message_retention_seconds  = 14 * 24 * 3600
  # Long polling: a receive call waits up to 20 s for a message instead of
  # returning empty immediately, which keeps the worker's request count low.
  receive_wait_time_seconds = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 5
  })
}

# The API is a producer too: an answered check-in queues a triage job.
# Send only; the worker is the one consumer (worker.tf).
data "aws_iam_policy_document" "task_enqueue" {
  statement {
    sid       = "EnqueueJobs"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.jobs.arn]
  }
}

resource "aws_iam_role_policy" "task_enqueue" {
  name   = "enqueue-jobs"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_enqueue.json
}
