"""
Script de teste para validar segurança da migration 0016 em ambiente real.
Execute ANTES de fazer deploy em produção.
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from transport.models import Trip, TripMovement
from decimal import Decimal
from datetime import date

def test_existing_trips():
    """Testa se viagens existentes continuam funcionando"""
    print("\n" + "="*60)
    print("TESTE 1: Viagens Existentes")
    print("="*60)
    
    trips_with_expenses = Trip.objects.filter(base_expense_value__gt=0)
    count = trips_with_expenses.count()
    
    print(f"✓ Encontradas {count} viagens com gastos")
    
    if count > 0:
        sample = trips_with_expenses.first()
        print(f"\nAmostra - Viagem #{sample.id}:")
        print(f"  - base_expense_value: R$ {sample.base_expense_value}")
        print(f"  - expense_items: {sample.expense_items}")
        print(f"  - Status: {'NOVO FORMATO' if sample.expense_items else 'FORMATO ANTIGO (OK)'}")
        
        # Testar sync
        initial_movements = sample.movements.filter(movement_type='expense').count()
        print(f"  - Movimentações antes sync: {initial_movements}")
        
        try:
            sample.sync_expense_movements()
            after_movements = sample.movements.filter(movement_type='expense').count()
            print(f"  - Movimentações após sync: {after_movements}")
            print(f"  ✓ sync_expense_movements() funciona com dados antigos")
        except Exception as e:
            print(f"  ✗ ERRO ao sincronizar: {e}")
            return False
    
    return True

def test_new_format():
    """Testa criação de viagem com novo formato (expense_items)"""
    print("\n" + "="*60)
    print("TESTE 2: Novo Formato (expense_items)")
    print("="*60)
    
    # Buscar um veículo existente
    from transport.models import Vehicle
    vehicle = Vehicle.objects.first()
    
    if not vehicle:
        print("⚠ Nenhum veículo cadastrado, pulando teste")
        return True
    
    print(f"Criando viagem teste com veículo: {vehicle.plate}")
    
    try:
        trip = Trip.objects.create(
            vehicle=vehicle,
            date=date.today(),
            start_date=date.today(),
            modality='per_ton',
            tons=Decimal('49.610'),
            rate_per_ton=Decimal('123.00'),
            total_value=Decimal('6102.03'),
            expense_items=[
                {'valor': 28.0, 'descricao': 'Balsa'},
                {'valor': 149.0, 'descricao': 'concerto da lona'}
            ]
        )
        
        print(f"✓ Viagem #{trip.id} criada com sucesso")
        print(f"  - expense_items: {trip.expense_items}")
        
        # Testar sync
        trip.sync_expense_movements()
        movements = trip.movements.filter(movement_type='expense', expense_category='other')
        
        print(f"✓ Movimentações criadas: {movements.count()}")
        for mov in movements:
            print(f"  - R$ {mov.amount} - {mov.description}")
        
        if movements.count() == 2:
            print("✓ SUCESSO: 2 movimentações separadas criadas")
        else:
            print(f"✗ ERRO: Esperado 2, criado {movements.count()}")
            return False
        
        # Limpar teste
        trip.delete()
        print("✓ Viagem teste removida")
        
    except Exception as e:
        print(f"✗ ERRO ao criar viagem: {e}")
        return False
    
    return True

def test_old_format():
    """Testa criação de viagem com formato antigo (base_expense_value)"""
    print("\n" + "="*60)
    print("TESTE 3: Formato Antigo (base_expense_value)")
    print("="*60)
    
    from transport.models import Vehicle
    vehicle = Vehicle.objects.first()
    
    if not vehicle:
        print("⚠ Nenhum veículo cadastrado, pulando teste")
        return True
    
    print(f"Criando viagem teste com veículo: {vehicle.plate}")
    
    try:
        trip = Trip.objects.create(
            vehicle=vehicle,
            date=date.today(),
            start_date=date.today(),
            modality='per_ton',
            tons=Decimal('50.000'),
            rate_per_ton=Decimal('100.00'),
            total_value=Decimal('5000.00'),
            base_expense_value=Decimal('177.00'),  # Formato antigo
            expense_items=None  # Explicitamente None
        )
        
        print(f"✓ Viagem #{trip.id} criada (formato antigo)")
        print(f"  - base_expense_value: R$ {trip.base_expense_value}")
        print(f"  - expense_items: {trip.expense_items}")
        
        # Testar sync
        trip.sync_expense_movements()
        movements = trip.movements.filter(movement_type='expense', expense_category='other')
        
        print(f"✓ Movimentações criadas: {movements.count()}")
        for mov in movements:
            print(f"  - R$ {mov.amount} - {mov.description}")
        
        if movements.count() == 1 and movements.first().amount == Decimal('177.00'):
            print("✓ SUCESSO: 1 movimentação com valor total criada")
        else:
            print(f"✗ ERRO: Comportamento inesperado")
            return False
        
        # Limpar teste
        trip.delete()
        print("✓ Viagem teste removida")
        
    except Exception as e:
        print(f"✗ ERRO ao criar viagem: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

def main():
    """Executa todos os testes"""
    print("\n" + "="*60)
    print("VALIDAÇÃO DE SEGURANÇA - Migration 0016")
    print("Ambiente: " + os.getenv('DJANGO_SETTINGS_MODULE', 'unknown'))
    print("="*60)
    
    results = {
        'existing_trips': test_existing_trips(),
        'new_format': test_new_format(),
        'old_format': test_old_format(),
    }
    
    print("\n" + "="*60)
    print("RESULTADO FINAL")
    print("="*60)
    
    for test_name, result in results.items():
        status = "✓ PASSOU" if result else "✗ FALHOU"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*60)
    if all_passed:
        print("✓✓✓ TODOS OS TESTES PASSARAM ✓✓✓")
        print("Migration 0016 é SEGURA para produção")
    else:
        print("✗✗✗ ALGUNS TESTES FALHARAM ✗✗✗")
        print("NÃO FAZER DEPLOY até corrigir problemas")
    print("="*60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
