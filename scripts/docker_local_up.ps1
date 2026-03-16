$ErrorActionPreference = 'Stop'

Set-Location "c:\Engenharia de Software\Planejamento Financeiro"

if (-not (Test-Path "fintech-saas/.env.docker.local")) {
    Copy-Item "fintech-saas/.env.docker.local.example" "fintech-saas/.env.docker.local"
    Write-Host "Arquivo fintech-saas/.env.docker.local criado a partir do exemplo."
}

if (-not (Test-Path "fintech-saas/.env.docker.production")) {
    Copy-Item "fintech-saas/.env.docker.production.example" "fintech-saas/.env.docker.production"
    Write-Host "Arquivo fintech-saas/.env.docker.production criado a partir do exemplo."
}

Write-Host "Subindo stack local Docker..."
docker compose -f docker-compose.local.yml up -d --build

Write-Host "Status dos serviços:"
docker compose -f docker-compose.local.yml ps

Write-Host "Concluído. Acesse: http://localhost:8080"
