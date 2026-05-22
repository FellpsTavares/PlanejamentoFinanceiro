"""
PLANO DE DEPLOY PARA PRODUÇÃO - Migration 0016
Data: 22/05/2026

STATUS ATUAL DO BANCO:
- 29 viagens cadastradas
- 7 viagens com gastos (base_expense_value > 0)
- 22 viagens sem gastos

ANÁLISE DE RISCO: ✓ BAIXO
================================

MUDANÇAS:
1. Adiciona campo expense_items (JSONField, nullable)
2. Mantém campo base_expense_value (sem alteração)
3. Atualiza serializer para aceitar expense_items
4. Modifica sync_expense_movements() com retrocompatibilidade

GARANTIAS DE SEGURANÇA:
✓ Campo nullable - não afeta dados existentes
✓ Default list - não modifica registros atuais
✓ Retrocompatibilidade total - base_expense_value continua funcionando
✓ Rollback simples disponível
✓ Sem perda de dados

CENÁRIOS TESTADOS:
1. Viagens antigas (com base_expense_value) - ✓ FUNCIONAM
2. Viagens novas (com expense_items) - ✓ FUNCIONAM
3. Viagens sem gastos - ✓ FUNCIONAM
4. Relatórios de gastos - ✓ FUNCIONAM

PROCEDIMENTO DE DEPLOY:
================================

FASE 1: BACKUP (CRÍTICO)
1. Backup completo do banco de dados
   ```bash
   pg_dump -U elofinanceiro elofinanceiro > backup_pre_migration_0016_$(date +%Y%m%d_%H%M%S).sql
   ```

2. Backup específico da tabela transport_trip
   ```bash
   pg_dump -U elofinanceiro -t transport_trip elofinanceiro > backup_trips_$(date +%Y%m%d_%H%M%S).sql
   ```

FASE 2: VALIDAÇÃO PRÉ-DEPLOY
3. Conferir migration está no repositório
   ✓ fintech-saas/transport/migrations/0016_trip_expense_items.py

4. Verificar dependências
   ✓ Depende de: 0015_maintenance_fleet
   ✓ Próxima: Nenhuma (última migration)

FASE 3: APLICAÇÃO
5. Aplicar migration
   ```bash
   python manage.py migrate transport 0016
   ```

6. Verificar campo criado
   ```sql
   \d transport_trip
   ```
   Deve mostrar: expense_items | jsonb

FASE 4: TESTES PÓS-DEPLOY
7. Testar viagem antiga (formulário tradicional)
   - Criar viagem com base_expense_value
   - Verificar se sync_expense_movements() funciona
   - Confirmar relatório mostra gasto corretamente

8. Testar viagem nova (chat)
   - Criar viagem com múltiplos gastos via chat
   - Verificar se cria múltiplas movimentações
   - Confirmar relatórios mostram gastos separados

9. Testar viagens existentes
   - Acessar lista de viagens
   - Verificar se todas carregam sem erro
   - Editar uma viagem antiga
   - Confirmar salva sem problemas

FASE 5: MONITORAMENTO (PRIMEIRAS 24H)
10. Monitorar logs de erro
11. Verificar performance de queries
12. Confirmar usuários não reportam problemas

ROLLBACK (SE NECESSÁRIO):
================================

Se algo der errado, reverter com:
```bash
python manage.py migrate transport 0015_maintenance_fleet
```

Isso remove o campo expense_items sem afetar:
- Dados existentes em base_expense_value
- Viagens cadastradas
- Movimentações criadas

APÓS ROLLBACK:
- Remover expense_items do serializer
- Reverter sync_expense_movements() para versão anterior
- Desabilitar chat temporariamente

CONTATOS DE EMERGÊNCIA:
================================
- Dev: [seu contato]
- DBA: [contato DBA]
- Suporte: [contato suporte]

APROVAÇÕES NECESSÁRIAS:
[ ] Lead Developer
[ ] DBA
[ ] Product Owner
[ ] QA Team

HORÁRIO RECOMENDADO:
- Período de baixa atividade
- Com equipe disponível para suporte
- Janela de 1-2 horas

CHECKLIST FINAL:
[ ] Backup completo realizado
[ ] Backup validado (restore teste)
[ ] Migration testada em staging
[ ] Equipe notificada
[ ] Plano de rollback revisado
[ ] Horário de manutenção comunicado
[ ] Monitoramento ativo preparado

================================
ASSINADO E APROVADO POR:

Nome: _____________________
Data: _____________________
Cargo: ____________________
"""