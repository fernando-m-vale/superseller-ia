############################################
# Power Orchestrator - Orquestração completa
############################################
# Lambda que coordena: App Runner + RDS + NAT Gateway
############################################

data "archive_file" "power_orchestrator_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/power-orchestrator"
  output_path = "${path.module}/../../lambda/power-orchestrator.zip"
}

############################################
# IAM Role + Policy para a Lambda Orquestradora
############################################

resource "aws_iam_role" "power_orchestrator_role" {
  name = "superseller-power-orchestrator-lambda-role"

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

data "aws_iam_policy_document" "power_orchestrator_policy_doc" {
  # Invocar Lambdas de App Runner
  statement {
    sid    = "AllowInvokeAppRunnerLambdas"
    effect = "Allow"

    actions = [
      "lambda:InvokeFunction"
    ]

    resources = [
      aws_lambda_function.power_startup.arn,
      aws_lambda_function.power_shutdown.arn,
    ]
  }

  # RDS Start/Stop
  statement {
    sid    = "AllowRDSControl"
    effect = "Allow"

    actions = [
      "rds:StartDBInstance",
      "rds:StopDBInstance",
      "rds:DescribeDBInstances"
    ]

    resources = [
      "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:${var.rds_instance_identifier}"
    ]
  }

  # CodeBuild Start/Get
  statement {
    sid    = "AllowCodeBuildControl"
    effect = "Allow"

    actions = [
      "codebuild:StartBuild",
      "codebuild:BatchGetBuilds",
      "codebuild:BatchGetProjects"
    ]

    resources = [
      aws_codebuild_project.terraform_nat_enable.arn,
      aws_codebuild_project.terraform_nat_disable.arn,
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

resource "aws_iam_policy" "power_orchestrator_policy" {
  name        = "superseller-power-orchestrator-lambda-policy"
  description = "Permissões para orquestrar App Runner + RDS + NAT Gateway"
  policy      = data.aws_iam_policy_document.power_orchestrator_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "power_orchestrator_attach" {
  role       = aws_iam_role.power_orchestrator_role.name
  policy_arn = aws_iam_policy.power_orchestrator_policy.arn
}

############################################
# Lambda: Power Orchestrator
############################################

resource "aws_lambda_function" "power_orchestrator" {
  function_name = "superseller-power-orchestrator"
  role          = aws_iam_role.power_orchestrator_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"

  filename         = data.archive_file.power_orchestrator_zip.output_path
  source_code_hash = data.archive_file.power_orchestrator_zip.output_base64sha256

  timeout = 900 # 15 minutos (para aguardar RDS e CodeBuild)

  environment {
    variables = {
      DB_INSTANCE_IDENTIFIER            = var.rds_instance_identifier
      APPRUNNER_STARTUP_FUNCTION_NAME   = aws_lambda_function.power_startup.function_name
      APPRUNNER_SHUTDOWN_FUNCTION_NAME  = aws_lambda_function.power_shutdown.function_name
      CODEBUILD_NAT_ENABLE_PROJECT      = aws_codebuild_project.terraform_nat_enable.name
      CODEBUILD_NAT_DISABLE_PROJECT     = aws_codebuild_project.terraform_nat_disable.name
    }
  }

  tags = merge(local.common_tags, {
    Name = "superseller-power-orchestrator"
  })
}

############################################
# CodeBuild Projects para Terraform NAT
############################################

# IAM Role para CodeBuild
resource "aws_iam_role" "codebuild_terraform_role" {
  name = "superseller-codebuild-terraform-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Policy para CodeBuild executar Terraform
data "aws_iam_policy_document" "codebuild_terraform_policy_doc" {
  # Permissões para recursos do NAT Gateway
  statement {
    sid    = "AllowNATGatewayControl"
    effect = "Allow"

    actions = [
      "ec2:CreateNatGateway",
      "ec2:DeleteNatGateway",
      "ec2:DescribeNatGateways",
      "ec2:AllocateAddress",
      "ec2:ReleaseAddress",
      "ec2:DescribeAddresses",
      "ec2:AssociateAddress",
      "ec2:DisassociateAddress",
      "ec2:CreateRoute",
      "ec2:DeleteRoute",
      "ec2:DescribeRouteTables",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
      "ec2:DescribeInternetGateways",
      "ec2:CreateTags",
      "ec2:DeleteTags",
    ]

    resources = ["*"] # NAT Gateway precisa de permissões amplas
  }

  # Backend do Terraform (S3 + DynamoDB)
  statement {
    sid    = "AllowTerraformBackend"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
    ]

    resources = [
      "arn:aws:s3:::superseller-terraform-state/*",
      "arn:aws:s3:::superseller-terraform-state",
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/terraform-state-lock",
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

resource "aws_iam_policy" "codebuild_terraform_policy" {
  name        = "superseller-codebuild-terraform-policy"
  description = "Permissões para CodeBuild executar Terraform (NAT Gateway)"
  policy      = data.aws_iam_policy_document.codebuild_terraform_policy_doc.json
}

resource "aws_iam_role_policy_attachment" "codebuild_terraform_attach" {
  role       = aws_iam_role.codebuild_terraform_role.name
  policy_arn = aws_iam_policy.codebuild_terraform_policy.arn
}

# CodeBuild Project: Enable NAT
resource "aws_codebuild_project" "terraform_nat_enable" {
  name          = "superseller-terraform-nat-enable"
  description   = "CodeBuild para habilitar NAT Gateway via Terraform"
  build_timeout = 20 # minutos
  service_role  = aws_iam_role.codebuild_terraform_role.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                      = "aws/codebuild/standard:7.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = false

    environment_variable {
      name  = "TF_VAR_enable_nat_gateway"
      value = "true"
    }

    environment_variable {
      name  = "TF_VAR_aws_region"
      value = var.aws_region
    }

    environment_variable {
      name  = "TF_VAR_vpc_id"
      value = var.vpc_id
    }
  }

  source {
    type            = "GITHUB"
    location        = "https://github.com/fernando-m-vale/superseller-ia.git"
    git_clone_depth = 1
    buildspec       = <<-BUILDSPEC
      version: 0.2
      phases:
        install:
          runtime-versions:
            terraform: 1.6
          commands:
            - echo "Instalando Terraform..."
            - terraform version
        pre_build:
          commands:
            - echo "Configurando backend do Terraform..."
            - cd infra/terraform/prod
            - terraform init
        build:
          commands:
            - echo "Aplicando Terraform para habilitar NAT Gateway..."
            - terraform apply -auto-approve -var="enable_nat_gateway=true"
        post_build:
          commands:
            - echo "Build concluído"
      BUILDSPEC
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/superseller-terraform-nat-enable"
      stream_name = "build"
    }
  }

  tags = merge(local.common_tags, {
    Name = "superseller-terraform-nat-enable"
  })
}

# CodeBuild Project: Disable NAT
resource "aws_codebuild_project" "terraform_nat_disable" {
  name          = "superseller-terraform-nat-disable"
  description   = "CodeBuild para desabilitar NAT Gateway via Terraform"
  build_timeout = 20 # minutos
  service_role  = aws_iam_role.codebuild_terraform_role.arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                      = "aws/codebuild/standard:7.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = false

    environment_variable {
      name  = "TF_VAR_enable_nat_gateway"
      value = "false"
    }

    environment_variable {
      name  = "TF_VAR_aws_region"
      value = var.aws_region
    }

    environment_variable {
      name  = "TF_VAR_vpc_id"
      value = var.vpc_id
    }
  }

  source {
    type            = "GITHUB"
    location        = "https://github.com/fernando-m-vale/superseller-ia.git"
    git_clone_depth = 1
    buildspec       = <<-BUILDSPEC
      version: 0.2
      phases:
        install:
          runtime-versions:
            terraform: 1.6
          commands:
            - echo "Instalando Terraform..."
            - terraform version
        pre_build:
          commands:
            - echo "Configurando backend do Terraform..."
            - cd infra/terraform/prod
            - terraform init
        build:
          commands:
            - echo "Aplicando Terraform para desabilitar NAT Gateway..."
            - terraform apply -auto-approve -var="enable_nat_gateway=false"
        post_build:
          commands:
            - echo "Build concluído"
      BUILDSPEC
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/superseller-terraform-nat-disable"
      stream_name = "build"
    }
  }

  tags = merge(local.common_tags, {
    Name = "superseller-terraform-nat-disable"
  })
}
