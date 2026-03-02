import requests, json

login = requests.post('http://127.0.0.1:8000/api/auth/login/', json={"username":"demo@example.com","password":"demo123456"})
print('LOGIN', login.status_code)
print(login.text[:1000])
access = login.json().get('access')
headers = {'Authorization': f'Bearer {access}'}
for path in ['/api/transactions/', '/api/investments/']:
    r = requests.get(f'http://127.0.0.1:8000'+path, headers=headers)
    print(path, r.status_code)
    if r.status_code == 200:
        print(json.dumps(r.json(), indent=2, ensure_ascii=False)[:2000])
    else:
        # print full text for debugging
        print(r.text[:4000])
