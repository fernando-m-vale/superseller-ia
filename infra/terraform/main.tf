resource "aws_s3_bucket" "data_lake" {
  bucket = "superseller-dev-dl-234642166969"
  tags = {
    Project    = "SuperSellerIA"
    Env        = "dev"
    Owner      = "fernando"
    CostCenter = "super-seller"
  }
}
