"""
Signals para o módulo Transport.
Recalcula automaticamente os valores da viagem quando movimentações são alteradas.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import TripMovement


@receiver(post_delete, sender=TripMovement)
def recalculate_trip_on_movement_delete(sender, instance, **kwargs):
    """
    Recalcula os valores da viagem quando uma movimentação é deletada.
    Isso garante que deletar movimentações (até mesmo via SQL) 
    reflita corretamente nos totais da viagem.
    """
    if instance.trip:
        instance.trip.recalculate_from_movements()


@receiver(post_save, sender=TripMovement)
def recalculate_trip_on_movement_save(sender, instance, created, **kwargs):
    """
    Recalcula os valores da viagem quando uma movimentação é criada ou alterada.
    Isso mantém os totais sempre sincronizados.
    """
    if instance.trip and not created:
        # Só recalcula em updates, não em creates
        # (creates já são tratados pelo sync_expense_movements)
        instance.trip.recalculate_from_movements()
