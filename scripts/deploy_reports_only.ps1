# Script para preparar deploy APENAS da correção de relatórios
# Este script prepara o commit com apenas o arquivo report_views.py

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PREPARAR DEPLOY: Apenas Relatórios PDF" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Este script irá preparar o deploy APENAS da correção de relatórios." -ForegroundColor Yellow
Write-Host "Não inclui: migration 0017, signals, checkbox modernizado.`n" -ForegroundColor Yellow

# Verificar status do git
Write-Host "[1/5] Verificando status do repositório..." -ForegroundColor Green
git status --short

Write-Host "`n[2/5] Verificando mudanças em report_views.py..." -ForegroundColor Green
$reportViewsChanged = git diff --name-only | Select-String "report_views.py"

if (-not $reportViewsChanged) {
    Write-Host "✗ Arquivo report_views.py não foi alterado!" -ForegroundColor Red
    Write-Host "Execute primeiro: .\scripts\fix_report_layout.ps1`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Arquivo report_views.py foi modificado`n" -ForegroundColor Green

Write-Host "[3/5] Visualizando mudanças..." -ForegroundColor Green
git diff fintech-saas/transport/report_views.py

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Arquivo que será commitado:" -ForegroundColor Yellow
Write-Host "• fintech-saas/transport/report_views.py`n" -ForegroundColor White

$confirm = Read-Host "Deseja continuar e fazer o commit? (S/N)"
if ($confirm -ne 'S' -and $confirm -ne 's') {
    Write-Host "Operação cancelada." -ForegroundColor Red
    exit
}

Write-Host "`n[4/5] Adicionando arquivo ao staging..." -ForegroundColor Green
git add fintech-saas/transport/report_views.py

Write-Host "`n[5/5] Fazendo commit..." -ForegroundColor Green
git commit -m "fix: corrige layout dos relatórios PDF para formato horizontal

- Altera orientação de portrait para landscape (A4)
- Reduz margens de 18-20mm para 15mm
- Ajusta fonte de 8pt para 7pt (mais legível)
- Otimiza padding das células da tabela
- Permite visualização de 10-11 colunas sem corte
- Não afeta banco de dados ou estrutura do sistema
- 100% retrocompatível"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erro ao fazer commit!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✓ COMMIT REALIZADO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Faça push para o GitHub:" -ForegroundColor White
Write-Host "   git push origin main`n" -ForegroundColor Cyan

Write-Host "2. Railway detectará automaticamente e fará deploy" -ForegroundColor White

Write-Host "`n3. Após o deploy, teste em produção:" -ForegroundColor White
Write-Host "   https://elofinanceiro.com.br`n" -ForegroundColor Cyan

Write-Host "4. Vá em Transportadora → Relatórios → Gerar PDF" -ForegroundColor White

Write-Host "`n5. Verifique que o PDF está em formato horizontal`n" -ForegroundColor White

Write-Host "Documentação completa:" -ForegroundColor Cyan
Write-Host "DEPLOY_REPORTS_RAILWAY.md`n" -ForegroundColor White

Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nDeseja fazer push agora? (S/N): " -ForegroundColor Yellow -NoNewline
$push = Read-Host

if ($push -eq 'S' -or $push -eq 's') {
    Write-Host "`nFazendo push para GitHub..." -ForegroundColor Green
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Push realizado com sucesso!" -ForegroundColor Green
        Write-Host "Railway iniciará o deploy automaticamente.`n" -ForegroundColor Cyan
        Write-Host "Acompanhe em: https://railway.app`n" -ForegroundColor White
    } else {
        Write-Host "`n✗ Erro ao fazer push!" -ForegroundColor Red
        Write-Host "Execute manualmente: git push origin main`n" -ForegroundColor Yellow
    }
} else {
    Write-Host "`nPush não realizado." -ForegroundColor Yellow
    Write-Host "Quando estiver pronto, execute:" -ForegroundColor White
    Write-Host "git push origin main`n" -ForegroundColor Cyan
}
