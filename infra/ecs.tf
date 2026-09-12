resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ---- Image ownership contract -----------------------------------------------
# When var.image_tag is set (bootstrap), that exact ECR tag is deployed.
# When it is null (steady state), Terraform reads the image currently
# registered in the latest ACTIVE task-definition revision — i.e. whatever
# the GitHub Actions pipeline last deployed — and carries it forward. A
# Terraform apply therefore changes task *shape* (cpu, memory, env, roles)
# but never rolls the image back.
data "aws_ecs_task_definition" "current" {
  count           = var.image_tag == null ? 1 : 0
  task_definition = local.service_name
}

data "aws_ecs_container_definition" "current" {
  count           = var.image_tag == null ? 1 : 0
  task_definition = data.aws_ecs_task_definition.current[0].arn
  container_name  = local.container_name
}

locals {
  image = (
    var.image_tag != null
    ? "${data.aws_ecr_repository.api.repository_url}:${var.image_tag}"
    : data.aws_ecs_container_definition.current[0].image
  )
  # APP_VERSION mirrors the tag portion of the image so /health reports it.
  app_version = element(split(":", local.image), length(split(":", local.image)) - 1)
}

resource "aws_ecs_task_definition" "api" {
  family                   = local.service_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  # The pipeline registers new revisions of this family (same shape, new
  # image). Refresh this resource from the latest ACTIVE revision so those
  # revisions are recognised as the current state rather than drift.
  track_latest = true

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64" # images are built for linux/amd64
  }

  container_definitions = jsonencode([{
    name      = local.container_name
    image     = local.image
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "APP_VERSION", value = local.app_version },
      { name = "CORS_ALLOWED_ORIGINS", value = join(",", var.cors_allowed_origins) },
      { name = "CLERK_ISSUER", value = var.clerk_issuer },
      { name = "CORS_ALLOWED_ORIGIN_REGEX", value = var.cors_allowed_origin_regex },
    ]

    # Database credentials, fetched by the ECS agent (execution role) from
    # the foundation's secret at container start and injected as plain
    # environment inside the container only. The `:key::` suffix picks one
    # JSON field of the secret (current version, default stage).
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

    # ECS-level liveness: a failing container is replaced by the scheduler
    # even before a load balancer exists.
    healthCheck = {
      command = [
        "CMD-SHELL",
        "python -c \"import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:${var.container_port}/health', timeout=2).status == 200 else 1)\""
      ]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = data.aws_region.current.region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = local.service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Rolling deploys: bring the new task up (200%) before the old one goes
  # away (100% minimum), and roll back automatically if the new one never
  # becomes healthy instead of retrying forever.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = local.service_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true # required to reach ECR/CloudWatch without a NAT gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = local.container_name
    container_port   = var.container_port
  }

  # Give a fresh task time to boot before ALB health checks can mark it
  # unhealthy and trigger a replacement.
  health_check_grace_period_seconds = 60

  depends_on = [
    aws_iam_role_policy_attachment.task_execution_managed,
    aws_iam_role_policy.task_execution_secrets, # the agent must be able to read the secret before a task launches
    aws_lb_listener.http,
  ]
}
