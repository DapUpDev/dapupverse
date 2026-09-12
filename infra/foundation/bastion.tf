# "A way in" without opening a port. The bastion has NO inbound rules and
# no SSH key; AWS Systems Manager Session Manager is the only way onto it.
# The SSM agent (preinstalled on Amazon Linux 2023) opens an outbound
# connection to the SSM service and sessions ride back over that.
#
# It lives in a public subnet with a public IP so that outbound connection
# has a path to the internet. The fully private alternative, three SSM
# interface endpoints, costs about $22/month, more than the rest of this
# bastion combined; not worth it while learning.

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "bastion" {
  count              = var.bastion_enabled ? 1 : 0
  name               = "${local.name}-bastion"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# Exactly what Session Manager needs, nothing more.
resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  count      = var.bastion_enabled ? 1 : 0
  role       = aws_iam_role.bastion[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  count = var.bastion_enabled ? 1 : 0
  name  = "${local.name}-bastion"
  role  = aws_iam_role.bastion[0].name
}

resource "aws_security_group" "bastion" {
  count = var.bastion_enabled ? 1 : 0

  name        = "${local.name}-bastion"
  description = "SSM-managed bastion: no inbound; outbound to SSM and PostgreSQL only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-bastion" }
}

# Outbound 443: the SSM agent, and package updates.
resource "aws_vpc_security_group_egress_rule" "bastion_https" {
  count = var.bastion_enabled ? 1 : 0

  security_group_id = aws_security_group.bastion[0].id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
  description       = "SSM agent and package repos"
}

resource "aws_vpc_security_group_egress_rule" "bastion_to_rds" {
  count = var.bastion_enabled ? 1 : 0

  security_group_id            = aws_security_group.bastion[0].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.rds.id
  description                  = "To PostgreSQL"
}

resource "aws_instance" "bastion" {
  count = var.bastion_enabled ? 1 : 0

  ami                         = data.aws_ssm_parameter.al2023_arm64.value
  instance_type               = var.bastion_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.bastion[0].id]
  iam_instance_profile        = aws_iam_instance_profile.bastion[0].name
  associate_public_ip_address = true
  # No key_name: SSH is not a path onto this machine.

  # IMDSv2 only, so a request-forgery bug in anything running here cannot
  # read the instance credentials.
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  # psql on the box, for sessions that open a shell rather than a tunnel.
  user_data = <<-EOT
    #!/bin/bash
    dnf install -y postgresql17
  EOT

  tags = { Name = "${local.name}-bastion" }

  lifecycle {
    ignore_changes = [ami] # a newer AMI must not replace the box on every plan
  }
}
