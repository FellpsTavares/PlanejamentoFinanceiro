from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    Só as duas mudanças que este trabalho realmente precisa: o campo `category`
    (FK para finance.Category) em TripMovement, e a nova opção 'driver' no bucket
    de agregação `expense_category`.

    Deliberadamente NÃO inclui o drift de metadados (verbose_name/Meta.ordering em
    outros modelos do app, e a mudança de Driver.id de AutoField para BigAutoField
    refletindo DEFAULT_AUTO_FIELD) que o `makemigrations` detectou e agrupou junto
    por já existir no models.py antes deste trabalho. Driver.id é uma alteração de
    tipo de coluna (PK) numa tabela em produção — risco de categoria diferente de
    um AddField nulo, então fica de fora deste deploy para revisão à parte.
    """

    dependencies = [
        ('finance', '0005_category_default_amount_and_more'),
        ('transport', '0018_fuellog_extend'),
    ]

    operations = [
        migrations.AddField(
            model_name='tripmovement',
            name='category',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='trip_movements', to='finance.category'),
        ),
        migrations.AlterField(
            model_name='tripmovement',
            name='expense_category',
            field=models.CharField(blank=True, choices=[('fuel', 'Combustível'), ('other', 'Outros gastos'), ('driver', 'Salário/Comissão')], default='', max_length=20),
        ),
    ]
