#!/usr/bin/env pwsh
# =============================================================================
# Deploy Custom Domains - App Runner
# =============================================================================
# Este script faz o deploy dos custom domains em duas fases para contornar
# a limitação do Terraform com for_each em recursos ainda não criados.
#
# Uso: .\deploy-custom-domains.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Deploy Custom Domains - App Runner" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se estamos no diretório correto
if (-not (Test-Path ".\providers.tf")) {
    Write-Host "Erro: Execute este script do diretório infra/terraform/prod" -ForegroundColor Red
    exit 1
}

# Fase 1: Criar Custom Domain Associations
Write-Host "[FASE 1] Criando Custom Domain Associations..." -ForegroundColor Yellow
Write-Host "Isso vai gerar os registros de validação de certificado." -ForegroundColor Gray
Write-Host ""

terraform apply -auto-approve `
    -target=aws_apprunner_custom_domain_association.api `
    -target=aws_apprunner_custom_domain_association.web

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Erro na Fase 1. Verifique os logs acima." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[FASE 1] Concluída com sucesso!" -ForegroundColor Green
Write-Host ""

# Pequena pausa para garantir que os recursos estão disponíveis
Write-Host "Aguardando 10 segundos para sincronização..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Fase 2: Criar registros de validação e CNAMEs
Write-Host "[FASE 2] Criando registros DNS de validação e CNAMEs..." -ForegroundColor Yellow
Write-Host ""

terraform apply -auto-approve

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Erro na Fase 2. Verifique os logs acima." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Mostrar status dos custom domains
Write-Host "Status dos Custom Domains:" -ForegroundColor Cyan
Write-Host ""

$api_status = terraform output -raw api_custom_domain_status 2>$null
$web_status = terraform output -raw web_custom_domain_status 2>$null
$api_url = terraform output -raw api_url 2>$null
$web_url = terraform output -raw web_url 2>$null

Write-Host "API:" -ForegroundColor White
Write-Host "  Status: $api_status"
Write-Host "  URL: $api_url"
Write-Host ""
Write-Host "WEB:" -ForegroundColor White
Write-Host "  Status: $web_status"
Write-Host "  URL: $web_url"
Write-Host ""

if ($api_status -eq "pending_certificate_dns_validation" -or $web_status -eq "pending_certificate_dns_validation") {
    Write-Host "ATENÇÃO: Os certificados estão aguardando validação DNS." -ForegroundColor Yellow
    Write-Host "Isso pode levar alguns minutos. Verifique o status com:" -ForegroundColor Yellow
    Write-Host "  terraform output api_custom_domain_status" -ForegroundColor Gray
    Write-Host "  terraform output web_custom_domain_status" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ou no console AWS App Runner." -ForegroundColor Gray
}
elseif ($api_status -eq "active" -and $web_status -eq "active") {
    Write-Host "Todos os custom domains estão ativos e funcionais!" -ForegroundColor Green
}

