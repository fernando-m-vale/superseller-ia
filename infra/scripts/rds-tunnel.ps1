#!/usr/bin/env pwsh
# =============================================================================
# RDS SSH Tunnel via Bastion Host
# =============================================================================
# Este script abre um túnel SSH para acessar o RDS em subnet privada
#
# Pré-requisitos:
#   1. Bastion Host EC2 na mesma VPC (subnet pública)
#   2. Chave SSH (.pem) para acessar o Bastion
#   3. Security Group do RDS permitindo acesso do Bastion na porta 5432
#
# Uso:
#   .\rds-tunnel.ps1 -BastionIP "1.2.3.4" -RdsEndpoint "mydb.xxxxx.us-east-2.rds.amazonaws.com" -KeyPath "~/.ssh/bastion.pem"
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$BastionIP,
    
    [Parameter(Mandatory=$false)]
    [string]$RdsEndpoint,
    
    [Parameter(Mandatory=$false)]
    [string]$KeyPath = "$env:USERPROFILE\.ssh\superseller-bastion.pem",
    
    [Parameter(Mandatory=$false)]
    [int]$LocalPort = 5433,
    
    [Parameter(Mandatory=$false)]
    [int]$RdsPort = 5432,
    
    [Parameter(Mandatory=$false)]
    [string]$BastionUser = "ec2-user"
)

# Tentar obter valores do Terraform se não fornecidos
$TerraformDir = "$PSScriptRoot\..\terraform\prod"

if (-not $RdsEndpoint -and (Test-Path $TerraformDir)) {
    Push-Location $TerraformDir
    try {
        $rdsOutput = terraform output -raw rds_endpoint 2>$null
        if ($rdsOutput -and $rdsOutput -ne "null") {
            $RdsEndpoint = $rdsOutput -replace ":5432$", ""
        }
    } catch {}
    Pop-Location
}

# Validação
if (-not $BastionIP) {
    Write-Host "=============================================" -ForegroundColor Yellow
    Write-Host " ATENÇÃO: Bastion Host não encontrado" -ForegroundColor Yellow
    Write-Host "=============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para usar este script, você precisa:" -ForegroundColor White
    Write-Host "  1. Criar um Bastion Host EC2 na subnet pública" -ForegroundColor Gray
    Write-Host "  2. Configurar Security Group do RDS para permitir acesso do Bastion" -ForegroundColor Gray
    Write-Host "  3. Passar o IP do Bastion como parâmetro:" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\rds-tunnel.ps1 -BastionIP '1.2.3.4' -RdsEndpoint 'mydb.xxxxx.rds.amazonaws.com'" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

if (-not $RdsEndpoint) {
    Write-Host "ERRO: RDS Endpoint não encontrado." -ForegroundColor Red
    Write-Host "Forneça via parâmetro: -RdsEndpoint 'mydb.xxxxx.us-east-2.rds.amazonaws.com'" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $KeyPath)) {
    Write-Host "ERRO: Chave SSH não encontrada: $KeyPath" -ForegroundColor Red
    Write-Host "Forneça via parâmetro: -KeyPath 'C:\path\to\key.pem'" -ForegroundColor Yellow
    exit 1
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " RDS SSH Tunnel" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuração:" -ForegroundColor White
Write-Host "  Bastion Host: $BastionUser@$BastionIP" -ForegroundColor Gray
Write-Host "  RDS Endpoint: $RdsEndpoint" -ForegroundColor Gray
Write-Host "  Porta Local:  localhost:$LocalPort" -ForegroundColor Gray
Write-Host "  Chave SSH:    $KeyPath" -ForegroundColor Gray
Write-Host ""

# Comando SSH
$sshCmd = "ssh -i `"$KeyPath`" -N -L ${LocalPort}:${RdsEndpoint}:${RdsPort} ${BastionUser}@${BastionIP}"

Write-Host "Abrindo túnel SSH..." -ForegroundColor Yellow
Write-Host "Comando: $sshCmd" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Pressione Ctrl+C para encerrar o túnel" -ForegroundColor Yellow
Write-Host ""

# Executar SSH
Invoke-Expression $sshCmd

