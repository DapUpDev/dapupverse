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
