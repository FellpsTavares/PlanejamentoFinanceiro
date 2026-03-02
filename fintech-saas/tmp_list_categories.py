import requests, json
login = requests.post('http://127.0.0.1:8000/api/auth/login/', json={"username":"demo@example.com","password":"demo123456"})
access = login.json().get('access')
headers = {'Authorization': f'Bearer {access}'}
r = requests.get('http://127.0.0.1:8000/api/categories/', headers=headers)
print(r.status_code)
print(r.text)
