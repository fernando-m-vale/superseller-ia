# infra/terraform/prod/iam.tf
# =============================================================================
# IAM Roles - App Runner
# =============================================================================
# As roles específicas do App Runner estão definidas em apprunner.tf
# Este arquivo mantém compatibilidade para outros recursos que possam precisar
# =============================================================================

# Nota: As seguintes roles foram movidas para apprunner.tf:
# - apprunner_ecr_access (acesso ao ECR para pull de imagens)
# - apprunner_instance (acesso runtime para secrets e logs)
