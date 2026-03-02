import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
from finance.models import Transaction
User = get_user_model()
try:
    u = User.objects.get(email='demo@example.com')
    print('user', u)
    qs = Transaction.objects.filter(tenant=u.tenant, user=u).select_related('category','user')
    print('count:', qs.count())
except Exception as e:
    import traceback
    traceback.print_exc()
