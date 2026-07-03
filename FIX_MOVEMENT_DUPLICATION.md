# CORREÇÃO URGENTE: Bug de Duplicação de Movimentações

## 🐛 Problema Identificado

Quando o usuário marcava o checkbox **"Valor da viagem já recebido"** e depois salvava o andamento ou encerrava a viagem, o sistema estava:

1. **Deletando TODAS as movimentações de despesa** (incluindo as adicionadas manualmente)
2. **Recriando apenas as automáticas** (gastos base, combustível, expense_items)
3. **Causando perda de dados** e duplicação ao repetir o processo

### Por que isso acontecia?

A função `sync_expense_movements()` era chamada em **toda atualização** da viagem (`perform_update`) e deletava:

```python
existing_auto_movements = self.movements.filter(
    date=trip_date,
    movement_type='expense'  # ❌ Deletava TODAS, não só automáticas
)
existing_auto_movements.delete()
```

## ✅ Solução Implementada

### 1. Novo Campo: `is_auto_generated`

Adicionada migration `0017_tripmovement_is_auto_generated.py` que adiciona o campo:

```python
is_auto_generated = models.BooleanField(
    default=False,
    help_text='Indica se esta movimentação foi criada automaticamente pelo sistema'
)
```

### 2. Sincronização Inteligente

Agora `sync_expense_movements()` deleta **apenas movimentações automáticas**:

```python
existing_auto_movements = self.movements.filter(
    movement_type='expense',
    is_auto_generated=True  # ✅ Só automáticas
)
existing_auto_movements.delete()
```

### 3. Otimização de Performance

`perform_update` só chama `sync_expense_movements()` quando **campos de gastos mudam**:

```python
expense_fields_changed = (
    trip.base_expense_value != old_base_expense or
    trip.fuel_expense_value != old_fuel_expense or
    trip.expense_items != old_expense_items
)

if expense_fields_changed:
    trip.sync_expense_movements()
```

### 4. Visual Modernizado

Checkbox "Valor da viagem já recebido" agora tem estilo moderno (toggle switch).

## 🚀 Como Aplicar a Correção

### Passo 1: Inicie o Docker

```powershell
docker compose -f docker-compose.local.yml up -d
```

### Passo 2: Execute o script de correção

```powershell
.\scripts\fix_movement_duplication.ps1
```

Ou manualmente:

```powershell
# Aplicar migration
docker exec elofinanceiro-backend python manage.py migrate transport 0017

# Marcar movimentações existentes como manuais
docker exec elofinanceiro-backend python manage.py mark_existing_movements_manual

# Reconstruir backend
docker compose -f docker-compose.local.yml up -d --build backend
```

## 📊 Impacto nos Dados Existentes

- **Movimentações existentes**: Marcadas como `is_auto_generated=False` (manuais)
- **Novas movimentações automáticas**: Marcadas com `is_auto_generated=True`
- **Compatibilidade**: 100% retrocompatível, sem perda de dados

## ✨ Resultado

Agora você pode:

✅ Marcar/desmarcar "Valor recebido" sem duplicar  
✅ Adicionar movimentações manuais que **nunca serão deletadas**  
✅ Editar gastos base/combustível sem perder lançamentos manuais  
✅ Salvar andamento/encerrar viagem com segurança  

## 🔍 Validação

Após aplicar, teste:

1. Criar uma viagem com gastos via chat (expense_items)
2. Adicionar movimentação manual de gasto
3. Salvar andamento
4. Verificar que a movimentação manual **permanece**
5. Verificar que gastos automáticos foram atualizados corretamente
