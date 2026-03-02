import requests, json
login = requests.post('http://127.0.0.1:8000/api/auth/login/', json={"username":"demo@example.com","password":"demo123456"})
access = login.json().get('access')
headers = {'Authorization': f'Bearer {access}', 'Content-Type': 'application/json'}
# pick a category id from existing categories
cats_resp = requests.get('http://127.0.0.1:8000/api/categories/', headers=headers)
cats = cats_resp.json().get('results', []) if isinstance(cats_resp.json(), dict) else cats_resp.json()
print('categories count', len(cats))
if len(cats) > 0:
    cat_id = cats[0]['id']
    payload = {
        'description': 'Teste criada via API',
        'amount': '123.45',
        'type': 'expense',
        'category': cat_id,
        'transaction_date': '2026-02-26',
        'status': 'pending'
    }
    r = requests.post('http://127.0.0.1:8000/api/transactions/', headers=headers, json=payload)
    print('create status', r.status_code)
    try:
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(r.text)
else:
    print('no categories')
