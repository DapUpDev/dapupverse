terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state in S3 with native S3 locking (no DynamoDB table needed on
  # Terraform >= 1.10). The bucket is created once, out of band — see
  # infra/README.md "Bootstrap".
  backend "s3" {
    bucket       = "dapup-terraform-state-645674817735"
    key          = "prod/api/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
