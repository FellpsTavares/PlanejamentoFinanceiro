"""
Comando para identificar e corrigir abastecimentos com litros corrompidos por um bug
de frontend: ao editar um abastecimento sem reescrever o campo "Litros", o valor era
enviado cru (ex: "629.590") e uma heurística de formatação (normalizeInputDecimal)
interpretava o ponto como separador de milhar, multiplicando o valor por 1000
(629.59 L virava 629590 L). O bug foi corrigido no frontend; este comando serve para
consertar registros que já foram salvos com o valor inflado antes da correção.

Uso:
    # 1) Listar suspeitos (litros acima do limite, sem alterar nada)
    python manage.py fix_corrupted_fuel_liters

    # 2) Após revisar visualmente cada um, corrigir os que realmente foram afetados
    #    (divide liters por 1000 nos IDs informados)
    python manage.py fix_corrupted_fuel_liters --fix-ids=12,15,20
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from transport.models import FuelLog


class Command(BaseCommand):
    help = 'Lista (e opcionalmente corrige) abastecimentos com litros corrompidos por bug de edição (valor x1000)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold',
            type=float,
            default=2000,
            help='Litros acima deste valor são considerados suspeitos (padrão: 2000)',
        )
        parser.add_argument(
            '--fix-ids',
            type=str,
            default='',
            help='IDs separados por vírgula para corrigir (divide liters por 1000). Ex: --fix-ids=12,15,20',
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        fix_ids_raw = options.get('fix_ids') or ''

        if fix_ids_raw.strip():
            ids = [int(i.strip()) for i in fix_ids_raw.split(',') if i.strip()]
            logs = FuelLog.objects.filter(id__in=ids)
            if not logs.exists():
                self.stdout.write(self.style.WARNING('Nenhum abastecimento encontrado com os IDs informados.'))
                return
            for log in logs:
                old = log.liters
                new = (log.liters / Decimal('1000')).quantize(Decimal('0.001'))
                log.liters = new
                log.save(update_fields=['liters'])
                self.stdout.write(self.style.SUCCESS(
                    f'✓ ID {log.id} ({log.vehicle.plate}, {log.date}): {old} L → {new} L'
                ))
            return

        suspects = FuelLog.objects.filter(liters__gt=threshold).select_related('vehicle').order_by('vehicle__plate', '-date')
        if not suspects.exists():
            self.stdout.write(self.style.SUCCESS(f'Nenhum abastecimento com litros acima de {threshold} encontrado.'))
            return

        self.stdout.write(f'Abastecimentos suspeitos (litros > {threshold}):\n')
        for log in suspects:
            corrected = (log.liters / Decimal('1000')).quantize(Decimal('0.001'))
            self.stdout.write(
                f'  ID {log.id} | {log.vehicle.plate} | {log.date} | KM {log.odometer_km} | '
                f'litros atual: {log.liters} | se dividido por 1000: {corrected}'
            )
        self.stdout.write(self.style.WARNING(
            '\nRevise cada registro (ex: confira o valor pago e o preço por litro compatível) antes de corrigir.\n'
            'Para aplicar a correção (÷1000) nos que realmente estiverem errados, rode:\n'
            f'  python manage.py fix_corrupted_fuel_liters --fix-ids=<id1>,<id2>,...'
        ))
