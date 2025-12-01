#!/usr/bin/env pwsh
# =============================================================================
# Run Prisma Migrations
# =============================================================================
# Este script executa as migrations do Prisma no banco de produção
#
# Uso COM túnel SSH (RDS em subnet privada):
#   1. Em outro terminal, abra o túnel: .\rds-tunnel.ps1 ...
#   2. Execute este script: .\run-migrations.ps1 -UseTunnel
#
# Uso DIRETO (banco externo como Neon, Supabase):
#   .\run-migrations.ps1 -DatabaseUrl "postgresql://..."
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$DatabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseTunnel,
    
    [Parameter(Mandatory=$false)]
    [int]$TunnelPort = 5433,
    
    [Parameter(Mandatory=$false)]
    [string]$DbUser = "superseller_admin",
    
    [Parameter(Mandatory=$false)]
    [string]$DbPassword,
    
    [Parameter(Mandatory=$false)]
    [string]$DbName = "superseller"
)

$ProjectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$ApiDir = Join-Path $ProjectRoot "apps\api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Prisma Migrations - Produção" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Determinar DATABASE_URL
if ($DatabaseUrl) {
    $env:DATABASE_URL = $DatabaseUrl
    Write-Host "Usando DATABASE_URL fornecida" -ForegroundColor Green
}
elseif ($UseTunnel) {
    if (-not $DbPassword) {
        Write-Host "ERRO: Forneça a senha do banco com -DbPassword" -ForegroundColor Red
        Write-Host ""
        Write-Host "Exemplo:" -ForegroundColor Yellow
        Write-Host "  .\run-migrations.ps1 -UseTunnel -DbPassword 'sua-senha-aqui'" -ForegroundColor Cyan
        exit 1
    }
    
    $env:DATABASE_URL = "postgresql://${DbUser}:${DbPassword}@localhost:${TunnelPort}/${DbName}?schema=public"
    Write-Host "Usando túnel SSH na porta $TunnelPort" -ForegroundColor Green
}
else {
    Write-Host "ERRO: Forneça uma das opções:" -ForegroundColor Red
    Write-Host ""
    Write-Host "  1. DATABASE_URL direta (banco externo):" -ForegroundColor Yellow
    Write-Host "     .\run-migrations.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/db'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. Via túnel SSH (RDS em subnet privada):" -ForegroundColor Yellow
    Write-Host "     # Terminal 1: .\rds-tunnel.ps1 -BastionIP '1.2.3.4' -RdsEndpoint 'mydb.rds.amazonaws.com'" -ForegroundColor Cyan
    Write-Host "     # Terminal 2: .\run-migrations.ps1 -UseTunnel -DbPassword 'senha'" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Diretório: $ApiDir" -ForegroundColor Gray
Write-Host ""

# Mudar para o diretório da API
Push-Location $ApiDir

try {
    # Verificar conexão
    Write-Host "[1/3] Verificando conexão com o banco..." -ForegroundColor Yellow
    $result = npx prisma db execute --stdin 2>&1 <<< "SELECT 1;"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Não foi possível conectar ao banco de dados" -ForegroundColor Red
        Write-Host $result -ForegroundColor Gray
        exit 1
    }
    Write-Host "  ✓ Conexão OK" -ForegroundColor Green
    Write-Host ""

    # Verificar status das migrations
    Write-Host "[2/3] Verificando status das migrations..." -ForegroundColor Yellow
    npx prisma migrate status
    Write-Host ""

    # Executar migrations
    Write-Host "[3/3] Executando migrations..." -ForegroundColor Yellow
    npx prisma migrate deploy

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host " Migrations executadas com sucesso!" -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "ERRO: Falha ao executar migrations" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
    # Limpar variável de ambiente
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
}

