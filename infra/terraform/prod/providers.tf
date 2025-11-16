terraform {
  required_version = ">= 1.6.0"
  
  backend "local" {
    path = "terraform.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project    = "SuperSellerIA"
      Env        = "prod"
      Owner      = "fernando"
      CostCenter = "super-seller"
      ManagedBy  = "terraform"

  default_tags {
    tags = {
      Project     = "SuperSellerIA"
      Environment = "production"
      ManagedBy   = "Terraform"
      Owner       = "fernando"
      CostCenter  = "super-seller"
    }
  }
}
