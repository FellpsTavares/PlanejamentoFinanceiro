import requests, json

url = 'http://127.0.0.1:8000/api/auth/login/'
cred = {"username":"demo@example.com","password":"demo123456"}
try:
    r = requests.post(url, json=cred)
    print('LOGIN', r.status_code)
    try:
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(r.text)
    access = r.json().get('access')
    if not access:
        raise SystemExit('no access token')
    headers = {'Authorization': f'Bearer {access}'}
    r2 = requests.get('http://127.0.0.1:8000/api/transactions/', headers=headers)
    print('\nTRANSACTIONS', r2.status_code)
    try:
        print(json.dumps(r2.json(), indent=2, ensure_ascii=False)[:2000])
    except Exception:
        print(r2.text[:2000])
    r3 = requests.get('http://127.0.0.1:8000/api/investments/', headers=headers)
    print('\nINVESTMENTS', r3.status_code)
    try:
        print(json.dumps(r3.json(), indent=2, ensure_ascii=False)[:2000])
    except Exception:
        print(r3.text[:2000])
except Exception as e:
    print('ERROR', e)
