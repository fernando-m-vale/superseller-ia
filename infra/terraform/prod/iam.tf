resource "aws_iam_role" "ecs_task_execution" {
  name = "superseller-prod-ecs-task-execution-role"

resource "aws_iam_role" "ecs_execution" {
  name = "superseller-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "superseller-prod-ecs-task-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_base" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "superseller-prod-secrets-manager-access"
  role = aws_iam_role.ecs_task_execution.id
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/*"
    }]
  })
}

resource "aws_iam_role" "ecs_task_api" {
  name = "superseller-prod-ecs-task-api-role"
      Resource = [
        "${local.secrets_prefix}*"
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "superseller-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "superseller-prod-ecs-task-api-role"
  }
}

resource "aws_iam_role_policy" "ecs_task_api_secrets" {
  name = "superseller-prod-api-secrets-access"
  role = aws_iam_role.ecs_task_api.id
  tags = local.common_tags
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/*"
    }]
  })
}

resource "aws_iam_role" "ecs_task_web" {
  name = "superseller-prod-ecs-task-web-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = {
    Name = "superseller-prod-ecs-task-web-role"
  }
}

resource "aws_iam_role_policy" "ecs_task_web_secrets" {
  name = "superseller-prod-web-secrets-access"
  role = aws_iam_role.ecs_task_web.id
      Resource = [
        "${local.secrets_prefix}*"
      ]
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/*"
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${local.api_log_group}:*",
        "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:${local.web_log_group}:*"
      ]
    }]
  })
}
