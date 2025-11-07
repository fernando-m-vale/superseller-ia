terraform {
  required_version = ">= 1.6.0"
  backend "s3" {
    bucket  = "superseller-dev-tfstate-234642166969"
    key     = "global/s3/terraform.tfstate"
    region  = "us-east-2"
    encrypt = true
  }
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project    = "SuperSellerIA"
      Env        = "dev"
      Owner      = "fernando"
      CostCenter = "super-seller"
    }
  }
}
