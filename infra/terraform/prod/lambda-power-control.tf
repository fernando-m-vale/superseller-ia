############################################
# Lambda Power Control - App Runner
############################################
# Funções Lambda para ligar/desligar os serviços App Runner
# Útil para reduzir custos em horários de baixo uso
############################################

data "aws_caller_identity" "current" {}

############################################
# Empacotar código das Lambdas em .zip
############################################

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
# IAM Role + Policy para as Lambdas (App Runner + Logs)
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
  # Permissões App Runner
  statement {
    sid    = "AllowAppRunnerControl"
    effect = "Allow"

    actions = [
      "apprunner:PauseService",
      "apprunner:ResumeService",
      "apprunner:DescribeService",
      "apprunner:ListServices"
    ]

    resources = [
      "arn:aws:apprunner:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/superseller-*"
    ]
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
  description = "Permissões para Pausar/Resumir App Runner + Logs"
  policy      = data.aws_iam_policy_document.lambda_power_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "lambda_power_attach" {
  role       = aws_iam_role.lambda_power_role.name
  policy_arn = aws_iam_policy.lambda_power_policy.arn
}

############################################
# Lambda: SHUTDOWN (pausar serviços App Runner)
############################################

resource "aws_lambda_function" "power_shutdown" {
  function_name = "superseller-power-shutdown"
  role          = aws_iam_role.lambda_power_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"

  filename         = data.archive_file.power_shutdown_zip.output_path
  source_code_hash = data.archive_file.power_shutdown_zip.output_base64sha256

  timeout = 120

  environment {
    variables = {
      # ARNs dos serviços App Runner
      APPRUNNER_SERVICE_ARNS = jsonencode([
        aws_apprunner_service.api.arn,
        aws_apprunner_service.web.arn
      ])
    }
  }
}

############################################
# Lambda: STARTUP (resumir serviços App Runner)
############################################

resource "aws_lambda_function" "power_startup" {
  function_name = "superseller-power-startup"
  role          = aws_iam_role.lambda_power_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"

  filename         = data.archive_file.power_startup_zip.output_path
  source_code_hash = data.archive_file.power_startup_zip.output_base64sha256

  timeout = 300

  environment {
    variables = {
      # ARNs dos serviços App Runner
      APPRUNNER_SERVICE_ARNS = jsonencode([
        aws_apprunner_service.api.arn,
        aws_apprunner_service.web.arn
      ])
    }
  }
}
