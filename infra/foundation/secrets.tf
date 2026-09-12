# The master password is generated here and stored in Secrets Manager. The
# application will read it at start-up through the ECS task definition's
# `secrets` block; no human ever types it into an environment variable.
#
# Trade-off, stated plainly: because Terraform generates the value, it is
# also present in the Terraform state file. That state lives in a private,
# encrypted, versioned bucket only the admin user can read, which is
# acceptable while learning. The production alternative is
# `manage_master_user_password = true` on the instance, which keeps the
# value out of state entirely and rotates it automatically.

resource "random_password" "db" {
  length  = 32
  special = true
  # RDS forbids slash, at-sign, double quote and spaces in passwords; these
  # are accepted and also survive being placed in a connection URL.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db" {
  name        = "${var.project}/${var.environment}/postgres"
  description = "Master credentials for ${aws_db_instance.postgres.identifier}"

  # 0 = deleted immediately on destroy, so a re-apply can recreate the same
  # name. Production keeps the 30-day window so a deleted secret can be
  # recovered.
  recovery_window_in_days = var.learning_mode ? 0 : 30
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  # The same shape RDS uses for its own managed secrets, so tooling that
  # expects it works unchanged.
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    dbname   = aws_db_instance.postgres.db_name
    username = aws_db_instance.postgres.username
    password = random_password.db.result
  })
}
