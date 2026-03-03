import requests, json

def main():
    url = 'http://127.0.0.1:8000/api/auth/login/'
    data = {'username':'demo@example.com','password':'demo123456'}
    r = requests.post(url, json=data)
    print('status', r.status_code)
    try:
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(r.text)

    if r.status_code == 200:
        tok = r.json().get('access')
        headers = {'Authorization': f'Bearer {tok}'}
        me = requests.get('http://127.0.0.1:8000/api/users/me/', headers=headers)
        print('\n/me status', me.status_code)
        try:
            print(json.dumps(me.json(), indent=2, ensure_ascii=False))
        except Exception:
            print(me.text)

if __name__ == '__main__':
    main()
