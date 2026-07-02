# Script para recalcular valores de viagens após deletar movimentações manualmente
# Use este script quando deletar movimentações via SQL e os valores não atualizarem

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RECALCULAR VALORES DE VIAGENS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Este script recalcula os valores das viagens baseado" -ForegroundColor Yellow
Write-Host "nas movimentações existentes no banco de dados.`n" -ForegroundColor Yellow

Write-Host "Escolha uma opção:" -ForegroundColor Green
Write-Host "1 - Recalcular uma viagem específica (informar ID)" -ForegroundColor White
Write-Host "2 - Recalcular todas as viagens" -ForegroundColor White
Write-Host "0 - Cancelar`n" -ForegroundColor White

$option = Read-Host "Opção"

switch ($option) {
    "1" {
        $tripId = Read-Host "Digite o ID da viagem"
        
        if ([string]::IsNullOrWhiteSpace($tripId)) {
            Write-Host "ID inválido!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "`nRecalculando viagem ID $tripId..." -ForegroundColor Green
        docker exec elofinanceiro-backend python manage.py recalculate_trip_values --trip-id=$tripId
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Viagem recalculada com sucesso!" -ForegroundColor Green
            Write-Host "Os valores agora refletem as movimentações existentes." -ForegroundColor Cyan
        } else {
            Write-Host "`n✗ Erro ao recalcular viagem!" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host "`nATENÇÃO: Isso irá recalcular TODAS as viagens!" -ForegroundColor Yellow
        $confirm = Read-Host "Tem certeza? (S/N)"
        
        if ($confirm -ne 'S' -and $confirm -ne 's') {
            Write-Host "Operação cancelada." -ForegroundColor Red
            exit
        }
        
        Write-Host "`nRecalculando todas as viagens..." -ForegroundColor Green
        docker exec elofinanceiro-backend python manage.py recalculate_trip_values --all
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Todas as viagens recalculadas com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "`n✗ Erro ao recalcular viagens!" -ForegroundColor Red
        }
    }
    
    "0" {
        Write-Host "Operação cancelada." -ForegroundColor Red
        exit
    }
    
    default {
        Write-Host "Opção inválida!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "A partir da próxima versão, os valores serão" -ForegroundColor White
Write-Host "recalculados automaticamente via signals!" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
