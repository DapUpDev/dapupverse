# The API stack (ECS + ALB) already runs in the account's default VPC, and
# moving it here would recreate the load balancer: a new DNS name, a Vercel
# record change, a cutover. Instead the two VPCs are peered. Peering has no
# hourly charge (only $0.01/GB for cross-zone traffic), and the API's task
# security group is allowed straight into PostgreSQL by reference. The
# database still has no public address and no route to the internet.

data "aws_vpc" "peer" {
  count   = var.peer_with_default_vpc ? 1 : 0
  default = true
}

data "aws_route_table" "peer_main" {
  count  = var.peer_with_default_vpc ? 1 : 0
  vpc_id = data.aws_vpc.peer[0].id
  filter {
    name   = "association.main"
    values = ["true"]
  }
}

resource "aws_vpc_peering_connection" "peer" {
  count       = var.peer_with_default_vpc ? 1 : 0
  vpc_id      = aws_vpc.main.id
  peer_vpc_id = data.aws_vpc.peer[0].id
  auto_accept = true # same account, same region
  tags        = { Name = "${local.name}-to-default-vpc" }
}

# Lets each side resolve the other's private hostnames to private IPs.
resource "aws_vpc_peering_connection_options" "peer" {
  count                     = var.peer_with_default_vpc ? 1 : 0
  vpc_peering_connection_id = aws_vpc_peering_connection.peer[0].id
  requester {
    allow_remote_vpc_dns_resolution = true
  }
  accepter {
    allow_remote_vpc_dns_resolution = true
  }
}

# Foundation private tier -> default VPC: the return path for database replies.
resource "aws_route" "private_to_peer" {
  count                     = var.peer_with_default_vpc ? 1 : 0
  route_table_id            = aws_route_table.private.id
  destination_cidr_block    = data.aws_vpc.peer[0].cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.peer[0].id
}

# Default VPC -> foundation. Its main route table is shared by every default
# subnet, so one route covers all of the API's tasks.
resource "aws_route" "peer_to_private" {
  count                     = var.peer_with_default_vpc ? 1 : 0
  route_table_id            = data.aws_route_table.peer_main[0].id
  destination_cidr_block    = aws_vpc.main.cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection.peer[0].id
}

# Application security groups that may reach PostgreSQL, looked up by name
# in the peer VPC. Cross-VPC group references work over a same-region
# peering connection, so no IP ranges appear anywhere in the rules.
data "aws_security_group" "clients" {
  for_each = var.peer_with_default_vpc ? toset(var.db_client_security_group_names) : toset([])
  vpc_id   = data.aws_vpc.peer[0].id
  name     = each.value
}
