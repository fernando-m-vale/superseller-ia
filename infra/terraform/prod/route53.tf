# infra/terraform/prod/route53.tf
# =============================================================================
# Route53 DNS Records - App Runner Custom Domains
# =============================================================================
#
# IMPORTANTE: O deploy de custom domains deve ser feito em 2 fases:
#
# Fase 1: Criar os custom domain associations (gera os registros de validação)
#   terraform apply -target=aws_apprunner_custom_domain_association.api \
#                   -target=aws_apprunner_custom_domain_association.web
#
# Fase 2: Criar os registros de validação e CNAMEs
#   terraform apply
#
# Ou use o script: .\deploy-custom-domains.ps1
# =============================================================================

# -----------------------------------------------------------------------------
# Locals para converter sets em listas acessíveis por índice
# -----------------------------------------------------------------------------
locals {
  # Converte o set de registros de validação para lista
  api_validation_records_list = var.enable_custom_domains ? tolist(aws_apprunner_custom_domain_association.api[0].certificate_validation_records) : []
  web_validation_records_list = var.enable_custom_domains ? tolist(aws_apprunner_custom_domain_association.web[0].certificate_validation_records) : []
}

# -----------------------------------------------------------------------------
# Fallback: CNAME direto para service_url quando custom domains desabilitado
# -----------------------------------------------------------------------------
resource "aws_route53_record" "api_direct" {
  count = var.enable_custom_domains ? 0 : 1

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.api_fqdn
  type            = "CNAME"
  ttl             = 300
  records         = [aws_apprunner_service.api.service_url]
  allow_overwrite = true
}

resource "aws_route53_record" "web_direct" {
  count = var.enable_custom_domains ? 0 : 1

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.web_fqdn
  type            = "CNAME"
  ttl             = 300
  records         = [aws_apprunner_service.web.service_url]
  allow_overwrite = true
}

# -----------------------------------------------------------------------------
# API - CNAME principal do domínio (quando custom domains habilitado)
# -----------------------------------------------------------------------------
# Aponta api.superselleria.com.br para o dns_target do App Runner
resource "aws_route53_record" "api" {
  count = var.enable_custom_domains ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.api_fqdn
  type            = "CNAME"
  ttl             = 300
  records         = [aws_apprunner_custom_domain_association.api[0].dns_target]
  allow_overwrite = true
}

# -----------------------------------------------------------------------------
# WEB - CNAME principal do domínio (quando custom domains habilitado)
# -----------------------------------------------------------------------------
# Aponta app.superselleria.com.br para o dns_target do App Runner
resource "aws_route53_record" "web" {
  count = var.enable_custom_domains ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.web_fqdn
  type            = "CNAME"
  ttl             = 300
  records         = [aws_apprunner_custom_domain_association.web[0].dns_target]
  allow_overwrite = true
}

# -----------------------------------------------------------------------------
# Registros de Validação de Certificado
# -----------------------------------------------------------------------------
# O App Runner gera registros CNAME que precisam ser adicionados ao Route53
# para validar a propriedade do domínio. Esses registros são criados
# automaticamente após a criação do custom_domain_association.
#
# NOTA: O App Runner gera 2 registros por domínio
# -----------------------------------------------------------------------------

# API - Registro de validação 1
resource "aws_route53_record" "api_validation_0" {
  count = var.enable_custom_domains && length(local.api_validation_records_list) > 0 ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.api_validation_records_list[0].name
  type            = local.api_validation_records_list[0].type
  ttl             = 300
  records         = [local.api_validation_records_list[0].value]
  allow_overwrite = true
}

# API - Registro de validação 2
resource "aws_route53_record" "api_validation_1" {
  count = var.enable_custom_domains && length(local.api_validation_records_list) > 1 ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.api_validation_records_list[1].name
  type            = local.api_validation_records_list[1].type
  ttl             = 300
  records         = [local.api_validation_records_list[1].value]
  allow_overwrite = true
}

# WEB - Registro de validação 1
resource "aws_route53_record" "web_validation_0" {
  count = var.enable_custom_domains && length(local.web_validation_records_list) > 0 ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.web_validation_records_list[0].name
  type            = local.web_validation_records_list[0].type
  ttl             = 300
  records         = [local.web_validation_records_list[0].value]
  allow_overwrite = true
}

# WEB - Registro de validação 2
resource "aws_route53_record" "web_validation_1" {
  count = var.enable_custom_domains && length(local.web_validation_records_list) > 1 ? 1 : 0

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.web_validation_records_list[1].name
  type            = local.web_validation_records_list[1].type
  ttl             = 300
  records         = [local.web_validation_records_list[1].value]
  allow_overwrite = true
}
