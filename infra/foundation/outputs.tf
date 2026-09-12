output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "rds_address" {
  value = aws_db_instance.postgres.address
}

output "rds_port" {
  value = aws_db_instance.postgres.port
}

output "rds_db_name" {
  value = aws_db_instance.postgres.db_name
}

output "rds_security_group_id" {
  description = "Add application security groups via var.db_client_security_group_ids, not to this group directly."
  value       = aws_security_group.rds.id
}

output "db_secret_arn" {
  description = "Reference this ARN from an ECS task definition `secrets` block."
  value       = aws_secretsmanager_secret.db.arn
}

output "student_files_bucket" {
  value = aws_s3_bucket.student_files.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "bastion_instance_id" {
  value = var.bastion_enabled ? aws_instance.bastion[0].id : null
}

# Copy-paste: opens localhost:15432 to the private database, through the
# bastion, over SSM. Needs the Session Manager plugin (see README.md).
output "db_port_forward_command" {
  value = var.bastion_enabled ? join(" ", [
    "aws ssm start-session --region ${var.aws_region}",
    "--target ${aws_instance.bastion[0].id}",
    "--document-name AWS-StartPortForwardingSessionToRemoteHost",
    "--parameters host=${aws_db_instance.postgres.address},portNumber=5432,localPortNumber=15432",
  ]) : null
}
