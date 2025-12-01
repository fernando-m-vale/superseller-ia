
resource "aws_db_subnet_group" "main" {
  count = var.enable_rds ? 1 : 0

  name       = "superseller-prod-db-subnet-group"
  subnet_ids = local.rds_subnet_ids

  tags = merge(local.common_tags, {
    Name = "superseller-prod-db-subnet-group"
  })
}

resource "random_password" "rds" {
  count = var.enable_rds ? 1 : 0

  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "rds_password" {
  count = var.enable_rds ? 1 : 0

  name        = "prod/RDS_PASSWORD"
  description = "RDS PostgreSQL master password"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  count = var.enable_rds ? 1 : 0

  secret_id     = aws_secretsmanager_secret.rds_password[0].id
  secret_string = random_password.rds[0].result
}

resource "aws_db_instance" "main" {
  count = var.enable_rds ? 1 : 0

  identifier     = "superseller-prod-db"
  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  max_allocated_storage = 100

  db_name  = var.rds_database_name
  username = var.rds_username
  password = random_password.rds[0].result

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  publicly_accessible    = false

  multi_az                = var.rds_multi_az
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  skip_final_snapshot       = false
  final_snapshot_identifier = "superseller-prod-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  deletion_protection = true

  tags = merge(local.common_tags, {
    Name = "superseller-prod-db"
  })
}

resource "aws_secretsmanager_secret" "rds_url" {
  count = var.enable_rds ? 1 : 0

  name        = "prod/DB_URL_RDS"
  description = "RDS PostgreSQL connection URL"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "rds_url" {
  count = var.enable_rds ? 1 : 0

  secret_id     = aws_secretsmanager_secret.rds_url[0].id
  secret_string = "postgresql://${var.rds_username}:${random_password.rds[0].result}@${aws_db_instance.main[0].endpoint}/${var.rds_database_name}"
}
