import requests, json
r = requests.post('http://127.0.0.1:8000/api/auth/login/', json={"username":"demo@example.com","password":"demo123456"})
print(r.status_code)
print(r.text)
