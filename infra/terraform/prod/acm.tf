resource "aws_acm_certificate" "api" {
  count             = var.enable_custom_domains ? 1 : 0
  domain_name       = local.api_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name        = "superseller-api-cert"
    Application = "api"
  })
}

resource "aws_acm_certificate" "web" {
  count             = var.enable_custom_domains ? 1 : 0
  domain_name       = local.web_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name        = "superseller-web-cert"
    Application = "web"
  })
}

# Use tolist to convert the set to a list and access the first element
# This avoids the for_each issue with unknown keys during import
resource "aws_route53_record" "api_cert_validation" {
  count = var.enable_custom_domains ? 1 : 0

  allow_overwrite = true
  name            = tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_value]
  ttl             = 60
  type            = tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_route53_record" "web_cert_validation" {
  count = var.enable_custom_domains ? 1 : 0

  allow_overwrite = true
  name            = tolist(aws_acm_certificate.web[0].domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.web[0].domain_validation_options)[0].resource_record_value]
  ttl             = 60
  type            = tolist(aws_acm_certificate.web[0].domain_validation_options)[0].resource_record_type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "api" {
  count                   = var.enable_custom_domains ? 1 : 0
  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [aws_route53_record.api_cert_validation[0].fqdn]
}

resource "aws_acm_certificate_validation" "web" {
  count                   = var.enable_custom_domains ? 1 : 0
  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [aws_route53_record.web_cert_validation[0].fqdn]
}
