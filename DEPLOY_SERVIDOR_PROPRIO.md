# Deploy em Servidor Próprio (Frontend + Backend + PostgreSQL)

## Arquitetura recomendada
- Nginx servindo frontend estático (`fintech-web/dist`)
- Nginx fazendo proxy de `/api`, `/admin` e `/healthz` para Gunicorn (Django)
- Gunicorn executando `config.wsgi:application`
- PostgreSQL hospedado no mesmo servidor via Docker Compose

## 1) Backend - variáveis de ambiente
Use `fintech-saas/.env` com base em `fintech-saas/.env.example`:
- `APP_ENV=production`
- `DEBUG=False`
- `ALLOWED_HOSTS=elofinanceiro.com.br,www.elofinanceiro.com.br`
- `CORS_ALLOWED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br`
- `CSRF_TRUSTED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br`
- `SECURE_SSL_REDIRECT=true`
- `SESSION_COOKIE_SECURE=true`
- `CSRF_COOKIE_SECURE=true`
- `DB_NAME=elofinanceiro`
- `DB_USER=elofinanceiro`
- `DB_PASSWORD=troque_esta_senha_forte`
- `DB_HOST=db`
- `DB_PORT=5432`
- `DB_SSLMODE=disable`

## 2) Backend - instalação e migração
```bash
cd fintech-saas
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

## 3) Backend - subir com Gunicorn
```bash
cd fintech-saas
source venv/bin/activate
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 120
```

## 4) Frontend - build
```bash
cd fintech-web
npm install
npm run build
```

Crie `fintech-web/.env`:
```env
VITE_API_URL=/api
```

## 5) Nginx (exemplo de site)
```nginx
server {
    listen 80;
    server_name elofinanceiro.com.br www.elofinanceiro.com.br;

    root /caminho/fintech-web/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:8000/healthz/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 6) Smoke tests
- `https://elofinanceiro.com.br` abre frontend
- `https://elofinanceiro.com.br/healthz` retorna `{"status":"ok"}`
- Login funciona
- Endpoint autenticado (`/api/users/me/`) retorna 200
- Admin (`/admin/`) abre
