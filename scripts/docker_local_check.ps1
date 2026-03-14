$ErrorActionPreference = 'Stop'

Set-Location "c:\Engenharia de Software\Planejamento Financeiro"

Write-Host "1) Status dos serviços"
docker compose -f docker-compose.yml -f docker-compose.local.yml ps

Write-Host "2) Banco respondendo"
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T db pg_isready -U elofinanceiro -d elofinanceiro

Write-Host "3) Migrations"
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T backend python manage.py migrate --noinput

Write-Host "4) Check Django"
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T backend python manage.py check

Write-Host "5) Health via web"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -UseBasicParsing -TimeoutSec 20
    Write-Host $response.Content
} catch {
    Write-Host "Falha no health externo (localhost:8080)."
    throw
}

Write-Host "Validação local concluída com sucesso."
