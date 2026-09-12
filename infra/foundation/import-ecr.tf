# ONE-TIME ADOPTION. Delete this file after the first successful apply.
#
# These blocks tell the first `terraform apply` to take ownership of the
# existing registry instead of trying to create a second one. Once the two
# resources are in this stack's state the blocks are a no-op, but if the
# stack is ever destroyed and re-applied they would fail (nothing left to
# import), which is why the file goes away after adoption.
#
# Pairs with the `removed` blocks in infra/ecr.tf: the API stack stops
# tracking the same two resources without destroying them.

import {
  to = aws_ecr_repository.api
  id = "dapup-api"
}

import {
  to = aws_ecr_lifecycle_policy.api
  id = "dapup-api"
}
