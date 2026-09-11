# DNS for dapup.space is hosted at Vercel, not Route 53, so Terraform cannot
# write records itself. It requests the certificate, outputs the exact
# records to add in Vercel DNS (see `terraform output dns_records_to_add`),
# and — once they exist — waits for the certificate to be issued.

resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Waits (up to the provider's default timeout) for ACM to observe the
# validation CNAME. Only attempted once the operator confirms the record.
resource "aws_acm_certificate_validation" "api" {
  count           = var.enable_https ? 1 : 0
  certificate_arn = aws_acm_certificate.api.arn
}

locals {
  acm_validation = tolist(aws_acm_certificate.api.domain_validation_options)[0]
}
