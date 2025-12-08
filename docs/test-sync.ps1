# Arquivo: test-sync.ps1

# Configurações
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNzQwM2YzZS05NGI4LTRjZGEtYjU1Zi03ZGI1Y2ZiNjIyMjAiLCJ0ZW5hbnRJZCI6IjZjMDBlMGU2LTdjOTQtNDhjZi1hNzdkLTJlZjFhMjQ5OTc5NCIsImlhdCI6MTc2NDYyMzQxMywiZXhwIjoxNzY1MjI4MjEzfQ.Dkkv3qmh3VDWsxCpCaDRumPQixUYV9EXYZHkBgLiMX0
" # Cole o token aqui
$url = "https://api.superselleria.com.br/api/v1/sync/mercadolivre"

# Dados do corpo (Payload)
# Estamos enviando o tenantId para cobrir o cenário do código antigo
# Se a rota já estiver atualizada/segura, ela vai ignorar isso e usar o do token.
$body = @{
    tenantId = "6c00e0e6-7c94-48cf-a77d-2ef1a2499794"
} | ConvertTo-Json

# Headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

Write-Host "Disparando Sync para: $url"

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -Headers $headers -ErrorAction Stop
    Write-Host "✅ Sucesso! Resposta:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "❌ Erro na requisição:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    # Tenta mostrar detalhes do erro se for um erro HTTP (400, 500)
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $details = $reader.ReadToEnd()
        Write-Host "Detalhes do servidor: $details" -ForegroundColor Yellow
    }
}