from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import RecurringTransaction, Transaction
from datetime import timedelta
from dateutil.relativedelta import relativedelta


@receiver(post_save, sender=RecurringTransaction)
def create_installments(sender, instance, created, **kwargs):
    """Ao criar um RecurringTransaction, projeta e cria as transações futuras."""
    if not created:
        return

    date = instance.start_date
    for i in range(1, instance.installments_count + 1):
        Transaction.objects.create(
            tenant=instance.tenant,
            user=instance.user,
            description=instance.description,
            amount=instance.amount,
            type=instance.type,
            category=instance.category,
            transaction_date=date,
            due_date=date,
            status='pending',
            recurring=instance,
            current_installment=i,
        )

        # Avança a data conforme frequência
        if instance.frequency == 'monthly':
            date += relativedelta(months=1)
        elif instance.frequency == 'biweekly':
            date += timedelta(days=15)
        elif instance.frequency == 'weekly':
            date += timedelta(weeks=1)
