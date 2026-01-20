# =============================================================================
# EventBridge Scheduler - Agendamento de Jobs Internos
# =============================================================================
# Configura schedules para chamar endpoints internos do App Runner
# Documentacao: docs/OPERATIONS_SCHEDULER.md
# =============================================================================

# -----------------------------------------------------------------------------
# Secret para INTERNAL_JOBS_KEY
# -----------------------------------------------------------------------------
# NOTA: O secret deve ser criado manualmente no Secrets Manager antes de aplicar
# aws secretsmanager create-secret --name prod/INTERNAL_JOBS_KEY --secret-string "$(openssl rand -base64 32)"
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "internal_jobs_key" {
  count = var.enable_scheduler ? 1 : 0
  name  = "prod/INTERNAL_JOBS_KEY"
}

data "aws_secretsmanager_secret_version" "internal_jobs_key" {
  count     = var.enable_scheduler ? 1 : 0
  secret_id = data.aws_secretsmanager_secret.internal_jobs_key[0].id
}

# -----------------------------------------------------------------------------
# IAM Role para EventBridge Scheduler
# -----------------------------------------------------------------------------
resource "aws_iam_role" "scheduler_execution" {
  count = var.enable_scheduler ? 1 : 0
  name  = "superseller-scheduler-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "scheduler.amazonaws.com"
      }
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
      }
    }]
  })

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# IAM Policy para Scheduler - Permissão para invocar HTTP endpoints
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy" "scheduler_invoke_http" {
  count = var.enable_scheduler ? 1 : 0
  name  = "invoke-http-endpoint"
  role  = aws_iam_role.scheduler_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "scheduler:InvokeHttp"
        ]
        Resource = [
          "arn:aws:scheduler:${var.aws_region}:${var.aws_account_id}:schedule/${aws_scheduler_schedule_group.superseller[0].name}/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Schedule Group
# -----------------------------------------------------------------------------
resource "aws_scheduler_schedule_group" "superseller" {
  count = var.enable_scheduler ? 1 : 0
  name  = "superseller-jobs"

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Schedule - Daily Metrics Rebuild
# -----------------------------------------------------------------------------
# Executa diariamente as 06:00 UTC (03:00 BRT) para recalcular metricas
# -----------------------------------------------------------------------------
resource "aws_scheduler_schedule" "daily_metrics_rebuild" {
  count       = var.enable_scheduler ? 1 : 0
  name        = "superseller-daily-metrics-rebuild"
  group_name  = aws_scheduler_schedule_group.superseller[0].name
  description = "Rebuild diario de listing_metrics_daily"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.scheduler_cron_expression
  schedule_expression_timezone = var.scheduler_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:scheduler:invokeHttp"
    role_arn = aws_iam_role.scheduler_execution[0].arn

    http_target {
      endpoint    = "https://${local.api_fqdn}/api/v1/jobs/rebuild-daily-metrics"
      http_method = "POST"
      
      header_parameters = {
        "X-Internal-Key" = data.aws_secretsmanager_secret_version.internal_jobs_key[0].secret_string
        "Content-Type"   = "application/json"
      }
    }

    input = jsonencode({
      tenantId = var.scheduler_tenant_id
      from     = "2024-01-01"
      to       = "2024-12-31"
    })

    retry_policy {
      maximum_event_age_in_seconds = var.scheduler_max_event_age
      maximum_retry_attempts       = var.scheduler_retry_attempts
    }

    # Dead Letter Queue (opcional)
    # dead_letter_config {
    #   arn = aws_sqs_queue.scheduler_dlq[0].arn
    # }
  }

  state = var.scheduler_enabled ? "ENABLED" : "DISABLED"
}

# -----------------------------------------------------------------------------
# Schedule - Mercado Livre Sync (opcional)
# -----------------------------------------------------------------------------
resource "aws_scheduler_schedule" "ml_sync" {
  count       = var.enable_scheduler && var.enable_ml_sync_schedule ? 1 : 0
  name        = "superseller-ml-sync"
  group_name  = aws_scheduler_schedule_group.superseller[0].name
  description = "Sync diario do Mercado Livre (listings + orders)"

  flexible_time_window {
    mode = "OFF"
  }

  # Executa as 05:00 UTC (02:00 BRT) - antes do rebuild de metricas
  schedule_expression          = "cron(0 5 * * ? *)"
  schedule_expression_timezone = var.scheduler_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:scheduler:invokeHttp"
    role_arn = aws_iam_role.scheduler_execution[0].arn

    http_target {
      endpoint    = "https://${local.api_fqdn}/api/v1/jobs/sync-mercadolivre"
      http_method = "POST"
      
      header_parameters = {
        "X-Internal-Key" = data.aws_secretsmanager_secret_version.internal_jobs_key[0].secret_string
        "Content-Type"   = "application/json"
      }
    }

    input = jsonencode({
      tenantId = var.scheduler_tenant_id
      daysBack = 30
    })

    retry_policy {
      maximum_event_age_in_seconds = var.scheduler_max_event_age
      maximum_retry_attempts       = var.scheduler_retry_attempts
    }
  }

  state = var.scheduler_enabled ? "ENABLED" : "DISABLED"
}

# -----------------------------------------------------------------------------
# CloudWatch Alarm - Falhas do Scheduler (opcional)
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "scheduler_failures" {
  count               = var.enable_scheduler && var.enable_scheduler_alarm ? 1 : 0
  alarm_name          = "superseller-scheduler-failures"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "InvocationsFailed"
  namespace           = "AWS/Scheduler"
  period              = 86400 # 24 horas
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alerta quando o scheduler de jobs falha"

  dimensions = {
    ScheduleGroup = aws_scheduler_schedule_group.superseller[0].name
  }

  # alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}
