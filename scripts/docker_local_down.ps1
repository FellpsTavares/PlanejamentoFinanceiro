$ErrorActionPreference = 'Stop'

Set-Location "c:\Engenharia de Software\Planejamento Financeiro"

docker compose -f docker-compose.yml -f docker-compose.local.yml down

Write-Host "Stack local parada."
