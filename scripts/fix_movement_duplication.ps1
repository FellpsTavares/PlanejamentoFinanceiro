# Script para aplicar correção do bug de duplicação de movimentações
# Execute este script APÓS iniciar o Docker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CORREÇÃO: Bug de Duplicação de Movimentações" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Este script irá:" -ForegroundColor Yellow
Write-Host "1. Aplicar migration 0017 (adicionar campo is_auto_generated)" -ForegroundColor Yellow
Write-Host "2. Marcar movimentações existentes como manuais" -ForegroundColor Yellow
Write-Host "3. Reconstruir o backend com as correções (signals ativos)" -ForegroundColor Yellow
Write-Host "4. Recalcular valores de todas as viagens`n" -ForegroundColor Yellow

$confirm = Read-Host "Deseja continuar? (S/N)"
if ($confirm -ne 'S' -and $confirm -ne 's') {
    Write-Host "Operação cancelada." -ForegroundColor Red
    exit
}

Write-Host "`n[1/3] Aplicando migration..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py migrate transport 0017

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao aplicar migration!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Marcando movimentações existentes como manuais..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py mark_existing_movements_manual

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao marcar movimentações!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/4] Reconstruindo backend com signals..." -ForegroundColor Green
docker compose -f docker-compose.local.yml up -d --build backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO ao reconstruir backend!" -ForegroundColor Red
    exit 1
}

Write-Host "`nAguardando backend inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n[4/4] Recalculando valores de todas as viagens..." -ForegroundColor Green
docker exec elofinanceiro-backend python manage.py recalculate_trip_values --all

if ($LASTEXITCODE -ne 0) {
    Write-Host "AVISO: Erro ao recalcular valores (não crítico)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✓ CORREÇÃO APLICADA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Agora você pode:" -ForegroundColor Yellow
Write-Host "• Editar viagens sem duplicar movimentações" -ForegroundColor Yellow
Write-Host "• Marcar/desmarcar 'Valor recebido' com segurança" -ForegroundColor Yellow
Write-Host "• Adicionar movimentações manuais sem perder ao salvar" -ForegroundColor Yellow
Write-Host "• Deletar movimentações e valores recalculam automaticamente!`n" -ForegroundColor Yellow

Write-Host "IMPORTANTE: Movimentações criadas automaticamente (gastos base," -ForegroundColor Cyan
Write-Host "combustível, expense_items) serão sincronizadas automaticamente." -ForegroundColor Cyan
Write-Host "Movimentações adicionadas manualmente serão preservadas." -ForegroundColor Cyan
Write-Host "`nSIGNALS ATIVOS: Deletar movimentações agora recalcula valores automaticamente!" -ForegroundColor Green
