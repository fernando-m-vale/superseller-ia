$Region = "us-east-2"
$AccountId = "234642166969"
$TaskFile = "api-taskdef.json"

$Secrets = @(
  "prod/ML_APP_ID",
  "prod/ML_APP_SECRET",
  "prod/ML_REDIRECT_URI",
  "prod/SHOPEE_CLIENT_ID",
  "prod/SHOPEE_CLIENT_SECRET",
  "prod/SHOPEE_REDIRECT_URI"
)

Write-Host "🔍 Buscando ARNs dos secrets no Secrets Manager ($Region)..."

foreach ($Secret in $Secrets) {
    $Arn = aws secretsmanager describe-secret --secret-id $Secret --region $Region --query "ARN" --output text
    if (-not $Arn) {
        Write-Host "❌ Não encontrado: $Secret"
    } else {
        Write-Host "✅ $Secret → $Arn"
        $Name = Split-Path $Secret -Leaf
        $Suffix = $Arn.Split('-')[-1]
        (Get-Content $TaskFile) -replace "$Name-XXXX", "$Name-$Suffix" | Set-Content $TaskFile
    }
}

Write-Host "✨ Substituição concluída no arquivo $TaskFile!"
