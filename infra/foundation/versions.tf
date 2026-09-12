terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Same state bucket as infra/ (the API stack), different key: the
  # foundation and the API are separate root modules with separate blast
  # radii. See README.md "Why a second root module".
  backend "s3" {
    bucket       = "dapup-terraform-state-645674817735"
    key          = "prod/foundation/terraform.tfstate"
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
      Stack       = "foundation"
      ManagedBy   = "terraform"
    }
  }
}
