import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from rest_framework.test import APIRequestFactory
from django.contrib.auth import get_user_model
from finance.views import TransactionViewSet, InvestmentViewSet
User = get_user_model()

u = User.objects.get(email='demo@example.com')
factory = APIRequestFactory()
request = factory.get('/api/transactions/')
request.user = u

try:
    view = TransactionViewSet()
    view.request = request
    view.action = 'list'
    resp = view.list(request)
    print('Transaction view response status:', getattr(resp, 'status_code', 'no status'))
    print(resp.data)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    view2 = InvestmentViewSet()
    view2.request = request
    resp2 = view2.list(request)
    print('Investment view response status:', getattr(resp2, 'status_code', 'no status'))
    print(resp2.data)
except Exception as e:
    import traceback
    traceback.print_exc()
