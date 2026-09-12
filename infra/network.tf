# Milestone 1 runs in the account's default VPC: public subnets with an
# internet gateway, so tasks can pull from ECR without a NAT gateway. The
# security group — not the subnet — is what keeps the tasks private: it
# accepts nothing from the internet, only (from Stage 3) the load balancer.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.service_name}-tasks"
  description = "ECS tasks for ${local.service_name}: no public ingress"
  vpc_id      = data.aws_vpc.default.id

  tags = { Name = "${local.service_name}-tasks" }
}

# Outbound only: ECR image pulls, CloudWatch Logs, and future AWS APIs.
resource "aws_vpc_security_group_egress_rule" "ecs_tasks_all" {
  security_group_id = aws_security_group.ecs_tasks.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "All outbound"
}

# One subnet per zone, but only var.az_count zones. A load balancer holds one
# public IPv4 address per zone it is attached to, and each address is
# billed hourly; two zones is the minimum it accepts and all this service
# needs. The tasks use the same subnets so every target is in a zone the
# load balancer serves.
data "aws_subnet" "default" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

locals {
  service_azs = slice(
    sort(distinct([for s in data.aws_subnet.default : s.availability_zone])),
    0, var.az_count,
  )
  service_subnet_ids = sort([
    for s in data.aws_subnet.default : s.id if contains(local.service_azs, s.availability_zone)
  ])
}
