# ================================================================
# infra/terraform/scheduler.tf
#
# Schedule semanal: EventBridge → Lambda → POST /sync/all-tenants/full
# Executa toda segunda-feira às 03:00 BRT (06:00 UTC)
# ================================================================

# ── Variáveis ──────────────────────────────────────────────────

variable "scheduler_service_token" {
  description = "Token secreto para chamadas internas do scheduler. Gerar com: node -e \"console.log(require('crypto').randomUUID())\""
  type        = string
  sensitive   = true
}

variable "api_url" {
  description = "URL pública da API do SuperSeller"
  type        = string
  default     = "https://api.superselleria.com.br"
}

# ── SSM Parameter Store — armazena o service token com segurança ─

resource "aws_ssm_parameter" "scheduler_service_token" {
  name        = "/superseller/scheduler/service-token"
  description = "Token de autenticação para o scheduler semanal de sync"
  type        = "SecureString"
  value       = var.scheduler_service_token

  tags = {
    Project     = "SuperSellerIA"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# ── IAM Role para a Lambda ──────────────────────────────────────

resource "aws_iam_role" "scheduler_lambda_role" {
  name = "superseller-scheduler-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = {
    Project   = "SuperSellerIA"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "scheduler_lambda_policy" {
  name = "superseller-scheduler-lambda-policy"
  role = aws_iam_role.scheduler_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:us-east-2:*:*"
      },
      {
        Sid      = "SSMReadToken"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.scheduler_service_token.arn
      }
    ]
  })
}

# ── Lambda — código inline (Node.js 20) ────────────────────────

data "archive_file" "scheduler_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda-scheduler.zip"

  source {
    filename = "index.mjs"
    content  = <<-LAMBDA_CODE
      import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

      const ssm = new SSMClient({ region: 'us-east-2' });
      const API_URL = process.env.API_URL;
      const TOKEN_SSM_PATH = process.env.SERVICE_TOKEN_SSM_PATH;

      export const handler = async (event) => {
        console.log('[WeeklySync] Iniciado pelo EventBridge Scheduler', {
          scheduledTime: event?.time,
          source: event?.source,
        });

        // 1. Busca o service token no SSM
        let serviceToken;
        try {
          const param = await ssm.send(new GetParameterCommand({
            Name: TOKEN_SSM_PATH,
            WithDecryption: true,
          }));
          serviceToken = param.Parameter.Value;
        } catch (err) {
          console.error('[WeeklySync] Falha ao buscar service token do SSM:', err.message);
          throw err;
        }

        // 2. Chama o endpoint de sync de todos os tenants
        console.log(`[WeeklySync] Chamando ${API_URL}/api/v1/sync/all-tenants/full`);
        const startedAt = Date.now();

        let response;
        try {
          response = await fetch(`${API_URL}/api/v1/sync/all-tenants/full`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceToken}`,
            },
            body: JSON.stringify({ source: 'eventbridge_weekly_scheduler' }),
            signal: AbortSignal.timeout(240_000), // 4 min timeout
          });
        } catch (err) {
          console.error('[WeeklySync] Erro na chamada HTTP à API:', err.message);
          throw err;
        }

        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          const body = await response.text();
          console.error(`[WeeklySync] API retornou ${response.status}:`, body);
          throw new Error(`API error ${response.status}: ${body}`);
        }

        const result = await response.json();
        console.log('[WeeklySync] Concluído com sucesso.', {
          durationMs,
          total: result?.summary?.total,
          success: result?.summary?.success,
          errors: result?.summary?.errors,
        });

        return {
          statusCode: 200,
          body: JSON.stringify(result),
        };
      };
    LAMBDA_CODE
  }
}

resource "aws_lambda_function" "weekly_sync" {
  function_name = "superseller-weekly-sync"
  description   = "Sync semanal de todos os tenants do SuperSeller IA"
  role          = aws_iam_role.scheduler_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 256

  filename         = data.archive_file.scheduler_lambda_zip.output_path
  source_code_hash = data.archive_file.scheduler_lambda_zip.output_base64sha256

  environment {
    variables = {
      API_URL                = var.api_url
      SERVICE_TOKEN_SSM_PATH = aws_ssm_parameter.scheduler_service_token.name
    }
  }

  tags = {
    Project     = "SuperSellerIA"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_log_group" "weekly_sync_logs" {
  name              = "/aws/lambda/superseller-weekly-sync"
  retention_in_days = 14

  tags = {
    Project   = "SuperSellerIA"
    ManagedBy = "terraform"
  }
}

# ── IAM Role para o EventBridge Scheduler ──────────────────────

resource "aws_iam_role" "eventbridge_scheduler_role" {
  name = "superseller-eventbridge-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })

  tags = {
    Project   = "SuperSellerIA"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role_policy" "eventbridge_invoke_lambda" {
  name = "superseller-eventbridge-invoke-lambda"
  role = aws_iam_role.eventbridge_scheduler_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = aws_lambda_function.weekly_sync.arn
    }]
  })
}

resource "aws_scheduler_schedule" "weekly_full_sync" {
  name        = "superseller-weekly-full-sync"
  description = "Refresh semanal de todos os listings de todos os tenants — toda segunda 03:00 BRT"

  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 60
  }

  schedule_expression          = "cron(0 6 ? * MON *)"
  schedule_expression_timezone = "America/Sao_Paulo"

  target {
    arn      = aws_lambda_function.weekly_sync.arn
    role_arn = aws_iam_role.eventbridge_scheduler_role.arn

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }

  tags = {
    Project     = "SuperSellerIA"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

output "scheduler_lambda_arn" {
  description = "ARN da Lambda de sync semanal"
  value       = aws_lambda_function.weekly_sync.arn
}

output "scheduler_schedule_arn" {
  description = "ARN do EventBridge Schedule"
  value       = aws_scheduler_schedule.weekly_full_sync.arn
}

output "scheduler_token_ssm_path" {
  description = "Caminho do token no SSM Parameter Store"
  value       = aws_ssm_parameter.scheduler_service_token.name
  sensitive   = true
}
