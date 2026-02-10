
locals {
  secret_names = {
    db_sselleria         = "prod/DB_SSELLERIA"
    jwt_secret           = "prod/JWT_SECRET"
    ml_app_id            = "prod/ML_APP_ID"
    ml_app_secret        = "prod/ML_APP_SECRET"
    ml_redirect_uri      = "prod/ML_REDIRECT_URI"
    shopee_client_id     = "prod/SHOPEE_CLIENT_ID"
    shopee_client_secret = "prod/SHOPEE_CLIENT_SECRET"
    shopee_redirect_uri  = "prod/SHOPEE_REDIRECT_URI"
    next_public_api_url  = "prod/NEXT_PUBLIC_API_URL"
    openai_api_key       = "prod/OPENAI_API_KEY"
    internal_jobs_key    = "prod/INTERNAL_JOBS_KEY"
  }
}

data "aws_secretsmanager_secret" "prod" {
  for_each = local.secret_names
  name     = each.value
}
