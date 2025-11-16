resource "aws_ecs_task_definition" "web" {
  family                   = "superseller-prod-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_web.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.web.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      {
        name  = "PORT"
        value = "3000"
      },
      {
        name  = "NODE_ENV"
        value = "production"
      }
    ]

    secrets = [
      {
        name      = "NEXT_PUBLIC_API_URL"
        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:prod/NEXT_PUBLIC_API_URL-uUtaAo"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = {
    Name = "superseller-prod-web-task"
  }
}
