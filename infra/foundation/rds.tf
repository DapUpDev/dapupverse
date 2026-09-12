resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = local.name }
}

# No inline rules: each allowed client is its own rule below, referenced by
# security group, never by IP address.
resource "aws_security_group" "rds" {
  name        = "${local.name}-postgres"
  description = "PostgreSQL: 5432 from named security groups only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-postgres" }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_bastion" {
  count = var.bastion_enabled ? 1 : 0

  security_group_id            = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.bastion[0].id
  description                  = "From bastion"
}

# The API's task security group in the peered default VPC (peering.tf).
resource "aws_vpc_security_group_ingress_rule" "rds_from_clients" {
  for_each = data.aws_security_group.clients

  security_group_id            = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = each.value.id
  description                  = "From ${each.key} (peered VPC)"
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name}-postgres"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false # the whole point: no public address, ever
  multi_az               = false # one AZ is the cost/availability trade-off at this scale

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "09:00-10:00" # 02:00-03:00 Pacific
  maintenance_window      = "sun:10:00-sun:11:00"
  copy_tags_to_snapshot   = true

  auto_minor_version_upgrade   = true
  performance_insights_enabled = true # 7-day retention is free
  monitoring_interval          = 0    # enhanced monitoring is not free; off for now

  # Learning-mode switches (see variables.tf). Production flips all of them.
  deletion_protection       = !var.learning_mode
  skip_final_snapshot       = var.learning_mode
  final_snapshot_identifier = var.learning_mode ? null : "${local.name}-postgres-final"
  apply_immediately         = var.learning_mode

  tags = { Name = "${local.name}-postgres" }
}
