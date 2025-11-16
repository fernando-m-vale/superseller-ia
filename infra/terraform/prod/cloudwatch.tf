resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/superseller/api"
  retention_in_days = 7

  tags = {
    Name = "superseller-prod-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/superseller/web"
  retention_in_days = 7

  tags = {
    Name = "superseller-prod-web-logs"
  }
}
