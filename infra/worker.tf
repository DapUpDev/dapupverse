# The worker: a second Fargate service running the SAME image as the API
# with a different command (`python -m app.worker`). No public address, no
# load balancer, no port. It reads the job queue and, for now, logs each job.
# The AI workflows module fills in real behaviour later.
#
# Permissions are its own (worker_task role): the queue, read-only access
# to the student-files bucket, and Anthropic models on Bedrock. Database
# credentials arrive the same way as for the API (execution role + secret).

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}-worker"
  retention_in_days = var.log_retention_days
}

resource "aws_iam_role" "worker_task" {
  name               = "${local.name}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "worker_task" {
  statement {
    sid = "ConsumeJobs"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.jobs.arn]
  }

  # Read-only: avatars today, student documents for RAG later. Writes stay
  # with the API, which is the only thing that validates uploads.
  statement {
    sid       = "ReadStudentFiles"
    actions   = ["s3:GetObject"]
    resources = ["${data.aws_s3_bucket.student_files.arn}/*"]
  }
  statement {
    sid       = "ListStudentFiles"
    actions   = ["s3:ListBucket"]
    resources = [data.aws_s3_bucket.student_files.arn]
  }

  # Anthropic models only, called directly or through a cross-region
  # inference profile (which is why the foundation-model ARN is region-less:
  # a profile in us-west-2 may route the call to another US region).
  statement {
    sid = "InvokeAnthropicOnBedrock"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:aws:bedrock:*::foundation-model/anthropic.*",
      "arn:aws:bedrock:${var.aws_region}:${local.account_id}:inference-profile/*anthropic*",
    ]
  }
}

resource "aws_iam_role_policy" "worker_task" {
  name   = "worker"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.worker_task.json
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  # Same ownership contract as the API: the pipeline registers revisions
  # with a new image; Terraform owns the shape.
  track_latest = true

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "worker"
    image     = local.image # always the image the API is running
    essential = true
    command   = ["python", "-m", "app.worker"]

    environment = [
      { name = "APP_VERSION", value = local.app_version },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "QUEUE_URL", value = aws_sqs_queue.jobs.url },
      { name = "STORAGE_BUCKET", value = data.aws_s3_bucket.student_files.bucket },
    ]

    secrets = [
      for env_name, json_key in {
        DB_HOST     = "host"
        DB_PORT     = "port"
        DB_NAME     = "dbname"
        DB_USER     = "username"
        DB_PASSWORD = "password"
        } : {
        name      = env_name
        valueFrom = "${data.aws_secretsmanager_secret.db.arn}:${json_key}::"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = data.aws_region.current.region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count

  # Spot capacity: a fraction of the price; an interrupted job just returns
  # to the queue. See the cluster's capacity providers in ecs.tf.
  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }

  # One worker at a time during a deploy: the old task stops, then the new
  # one starts. A short gap is fine; two workers on one queue is pointless.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = local.service_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id] # same group: reaches the database
    assign_public_ip = true                              # ECR, SQS, S3, Bedrock without a NAT gateway
  }

  depends_on = [
    aws_iam_role_policy_attachment.task_execution_managed,
    aws_iam_role_policy.task_execution_secrets,
  ]
}
