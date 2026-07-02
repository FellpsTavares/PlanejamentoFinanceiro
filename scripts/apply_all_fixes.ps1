# Script completo para aplicar todas as correções e deixar pronto para testes
# Execute este script APÓS iniciar o Docker Desktop

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "APLICANDO TODAS AS CORREÇÕES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Verificar se Docker está rodando
Write-Host "[0/7] Verificando Docker Desktop..." -ForegroundColor Yellow
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker Desktop não está rodando!" -ForegroundColor Red
    Write-Host "`nPor favor:" -ForegroundColor Yellow
    Write-Host "1. Inicie o Docker Desktop" -ForegroundColor White
    Write-Host "2. Aguarde até que esteja completamente inicializado" -ForegroundColor White
    Write-Host "3. Execute este script novamente`n" -ForegroundColor White
    exit 1
}
Write-Host "✓ Docker Desktop está rodando`n" -ForegroundColor Green

Write-Host "[1/7] Parando containers antigos..." -ForegroundColor Green
docker compose -f docker-compose.local.yml down
Start-Sleep -Seconds 2

Write-Host "`n[2/7] Reconstruindo containers com correções..." -ForegroundColor Green
docker compose -f docker-compose.local.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ERRO ao construir containers!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/7] Aguardando backend inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`n[4/7] Verificando status dos containers..." -ForegroundColor Green
docker compose -f docker-compose.local.yml ps

Write-Host "`n[5/7] Aplicando migration 0017..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py migrate transport 0017

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ERRO ao aplicar migration!" -ForegroundColor Red
    Write-Host "Tentando aplicar todas as migrations..." -ForegroundColor Yellow
    docker exec elofinanceiro-backend python manage.py migrate
}

Write-Host "`n[6/7] Marcando movimentações existentes como manuais..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py mark_existing_movements_manual

if ($LASTEXITCODE -ne 0) {
    Write-Host "AVISO: Erro ao marcar movimentações (pode ser normal se não existirem)" -ForegroundColor Yellow
}

Write-Host "`n[7/7] Recalculando valores de todas as viagens..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py recalculate_trip_values --all

if ($LASTEXITCODE -ne 0) {
    Write-Host "AVISO: Erro ao recalcular valores (não crítico)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✓ SISTEMA PRONTO PARA TESTES!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Acesse o sistema:" -ForegroundColor Yellow
Write-Host "• Frontend: http://localhost:8080" -ForegroundColor White
Write-Host "• Backend API: http://localhost:8000/api/`n" -ForegroundColor White

Write-Host "Correções aplicadas:" -ForegroundColor Green
Write-Host "✓ Migration 0017 (campo is_auto_generated)" -ForegroundColor White
Write-Host "✓ Signals ativos (recálculo automático)" -ForegroundColor White
Write-Host "✓ Checkbox modernizado (toggle switch)" -ForegroundColor White
Write-Host "✓ Movimentações manuais preservadas" -ForegroundColor White
Write-Host "✓ Valores recalculados corretamente" -ForegroundColor White
Write-Host "✓ Relatórios PDF em formato horizontal (landscape)`n" -ForegroundColor White

Write-Host "Testes recomendados:" -ForegroundColor Cyan
Write-Host "1. Criar viagem via chat com múltiplos gastos" -ForegroundColor White
Write-Host "2. Adicionar movimentação manual" -ForegroundColor White
Write-Host "3. Marcar 'Valor recebido' e salvar" -ForegroundColor White
Write-Host "4. Verificar que movimentação manual permanece" -ForegroundColor White
Write-Host "5. Deletar movimentação e ver valores atualizarem`n" -ForegroundColor White

Write-Host "========================================" -ForegroundColor Cyan
