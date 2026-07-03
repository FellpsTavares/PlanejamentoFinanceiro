# Script para aplicar correção de layout dos relatórios PDF
# Muda orientação para horizontal (landscape) para evitar corte de informações

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CORREÇÃO: Layout de Relatórios PDF" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Mudanças aplicadas no código:" -ForegroundColor Yellow
Write-Host "✓ Orientação: Vertical → Horizontal (landscape)" -ForegroundColor White
Write-Host "✓ Margens: 18-20mm → 15mm (mais espaço)" -ForegroundColor White
Write-Host "✓ Fonte tabela: 8pt → 7pt (mais legível)" -ForegroundColor White
Write-Host "✓ Fonte título: 16pt → 14pt" -ForegroundColor White
Write-Host "✓ Padding otimizado para mais colunas`n" -ForegroundColor White

# Verificar se Docker está rodando
Write-Host "[1/3] Verificando Docker Desktop..." -ForegroundColor Green
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker Desktop não está rodando!" -ForegroundColor Red
    Write-Host "`nInicie o Docker Desktop e execute este script novamente.`n" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Docker Desktop está rodando`n" -ForegroundColor Green

Write-Host "[2/3] Reconstruindo backend com correção..." -ForegroundColor Green
docker compose -f docker-compose.local.yml up -d --build backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ ERRO ao reconstruir backend!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Aguardando backend inicializar..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✓ CORREÇÃO APLICADA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Teste a correção:" -ForegroundColor Yellow
Write-Host "1. Acesse o módulo Transportadora" -ForegroundColor White
Write-Host "2. Vá em Relatórios" -ForegroundColor White
Write-Host "3. Gere um relatório de viagens detalhadas em PDF" -ForegroundColor White
Write-Host "4. Verifique que todas as colunas aparecem sem cortes`n" -ForegroundColor White

Write-Host "Tipos de relatório disponíveis:" -ForegroundColor Cyan
Write-Host "• Lançamentos (Gastos/Receitas)" -ForegroundColor White
Write-Host "• Viagens Detalhadas - Agora em HORIZONTAL!" -ForegroundColor Green
Write-Host "• Pagamentos ao Motorista" -ForegroundColor White
Write-Host "• Resumo por Veículo" -ForegroundColor White
Write-Host "• Resumo por Categoria de Despesa`n" -ForegroundColor White
