############################################
# Data sources básicos (se já existirem em outro .tf, pode remover aqui)
############################################

data "aws_caller_identity" "current" {}

variable "aws_region" {
  type    = string
  default = "us-east-2"
}

############################################
# Empacotar código das Lambdas em .zip
############################################

# path.module = infra/terraform/prod
# subimos 2 níveis até infra/, depois lambda/...
data "archive_file" "power_shutdown_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/power-shutdown"
  output_path = "${path.module}/../../lambda/power-shutdown.zip"
}

data "archive_file" "power_startup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/power-startup"
  output_path = "${path.module}/../../lambda/power-startup.zip"
}

############################################
# IAM Role + Policy para as Lambdas (apenas ECS + Logs)
############################################

resource "aws_iam_role" "lambda_power_role" {
  name = "superseller-power-control-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

data "aws_iam_policy_document" "lambda_power_policy_doc" {
  # Permissões ECS
  statement {
    sid    = "AllowECSUpdate"
    effect = "Allow"

    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:DescribeClusters"
    ]

    resources = ["*"]
  }

  # Logs no CloudWatch
  statement {
    sid    = "AllowCloudWatchLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
    ]
  }
}

resource "aws_iam_policy" "lambda_power_policy" {
  name        = "superseller-power-control-lambda-policy"
  description = "Permissões para Ligar/Desligar ECS + Logs"
  policy      = data.aws_iam_policy_document.lambda_power_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "lambda_power_attach" {
  role       = aws_iam_role.lambda_power_role.name
  policy_arn = aws_iam_policy.lambda_power_policy.arn
}

############################################
# Lambda: SHUTDOWN (desligar ambiente ECS)
############################################

resource "aws_lambda_function" "power_shutdown" {
  function_name = "superseller-power-shutdown"
  role          = aws_iam_role.lambda_power_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"

  filename         = data.archive_file.power_shutdown_zip.output_path
  source_code_hash = data.archive_file.power_shutdown_zip.output_base64sha256

  timeout = 60

  environment {
    variables = {
      AWS_REGION   = var.aws_region
      CLUSTER_NAME = "superseller-prod-cluster"
      ECS_SERVICES = jsonencode([
        "superseller-api-svc",
        "superseller-web-svc"
      ])
    }
  }
}

############################################
# Lambda: STARTUP (ligar ambiente ECS)
############################################

resource "aws_lambda_function" "power_startup" {
  function_name = "superseller-power-startup"
  role          = aws_iam_role.lambda_power_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"

  filename         = data.archive_file.power_startup_zip.output_path
  source_code_hash = data.archive_file.power_startup_zip.output_base64sha256

  timeout = 300 # 5 minutos é mais do que suficiente só pra ECS

  environment {
    variables = {
      AWS_REGION   = var.aws_region
      CLUSTER_NAME = "superseller-prod-cluster"
      ECS_SERVICES = jsonencode([
        "superseller-api-svc",
        "superseller-web-svc"
      ])
    }
  }
}
