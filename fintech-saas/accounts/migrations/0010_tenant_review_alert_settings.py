from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_tenant_account_notes_tenant_account_status_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='days_before_review_alert',
            field=models.PositiveIntegerField(default=30, verbose_name='Dias para alerta de revisão'),
        ),
        migrations.AddField(
            model_name='tenant',
            name='km_before_review_alert',
            field=models.PositiveIntegerField(default=1000, verbose_name='KM para alerta de revisão'),
        ),
    ]
