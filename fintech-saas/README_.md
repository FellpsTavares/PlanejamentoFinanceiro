# FinManager SaaS - Gestão Financeira Pessoal

MVP de um SaaS de Gestão Financeira com Backend Django + Frontend React, autenticação JWT, multi-tenant e CRUD completo.

## 📋 Requisitos

- Python 3.10+
- Node.js 16+
- npm ou yarn
- Git

## 🚀 Instalação e Setup

### Backend (Django)

1. **Clonar o repositório**
   ```bash
   cd /home/ubuntu/fintech-saas
   ```

2. **Instalar dependências**
   ```bash
   pip install -r requirements.txt
   ```

3. **Aplicar migrations**
   ```bash
   python manage.py migrate
   ```

4. **Popular banco com dados de teste**
   ```bash
   python manage.py seed_data
   ```

5. **Criar superusuário (opcional)**
   ```bash
   python manage.py createsuperuser
   ```

6. **Iniciar servidor Django**
   ```bash
   python manage.py runserver
   ```
   
   O servidor estará disponível em: `http://localhost:8000`

### Frontend (React)

1. **Navegar para pasta do frontend**
   ```bash
   cd /home/ubuntu/fintech-web
   ```

2. **Instalar dependências**
   ```bash
   npm install
   ```

3. **Iniciar servidor de desenvolvimento**
   ```bash
   npm run dev
   ```
   
   O frontend estará disponível em: `http://localhost:5173`

## 🔐 Credenciais de Teste

Após executar `seed_data`, use:

- **Email**: demo@example.com
- **Senha**: demo123456
- **Tenant**: demo

## 📚 Estrutura do Projeto

### Backend (Django)

```
fintech-saas/
├── config/                 # Configurações do Django
│   ├── settings.py        # Configurações principais
│   ├── urls.py            # URLs da API
│   ├── middleware.py      # Middleware multi-tenant
│   └── wsgi.py
├── accounts/              # App de autenticação e usuários
│   ├── models.py          # Modelos (Tenant, User)
│   ├── serializers.py     # Serializers
│   ├── views.py           # Views (ViewSets)
│   └── management/
│       └── commands/
│           └── seed_data.py  # Script de seed data
├── finance/               # App de finanças
│   ├── models.py          # Modelos (Category, Transaction)
│   ├── serializers.py     # Serializers
│   └── views.py           # Views (ViewSets)
├── manage.py
└── requirements.txt
```

### Frontend (React)

```
fintech-web/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   └── ProtectedRoute.jsx
│   ├── pages/             # Páginas
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Transactions.jsx
│   │   └── NewTransaction.jsx
│   ├── services/          # Serviços (API, Auth)
│   │   ├── api.js         # Configuração do Axios
│   │   ├── auth.js        # Serviço de autenticação
│   │   └── transactions.js # Serviço de transações
│   ├── styles/            # Estilos CSS
│   │   └── index.css
│   ├── App.jsx            # Componente principal
│   └── main.jsx           # Entrada da aplicação
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🔌 API Endpoints

### Autenticação

- `POST /api/auth/login/` - Fazer login
- `POST /api/auth/refresh/` - Renovar token JWT
- `POST /api/users/register/` - Registrar novo usuário
- `GET /api/users/me/` - Obter usuário atual

### Usuários

- `GET /api/users/` - Listar usuários
- `GET /api/users/{id}/` - Obter usuário específico
- `PUT /api/users/{id}/` - Atualizar usuário
- `PUT /api/users/{id}/update_profile/` - Atualizar perfil

### Tenants

- `GET /api/tenants/` - Listar tenants
- `GET /api/tenants/{slug}/` - Obter tenant por slug
- `GET /api/tenants/current/` - Obter tenant atual

### Categorias

- `GET /api/categories/` - Listar categorias
- `POST /api/categories/` - Criar categoria
- `GET /api/categories/{id}/` - Obter categoria
- `PUT /api/categories/{id}/` - Atualizar categoria
- `DELETE /api/categories/{id}/` - Deletar categoria
- `GET /api/categories/by_type/` - Categorias agrupadas por tipo

### Transações

- `GET /api/transactions/` - Listar transações
- `POST /api/transactions/` - Criar transação
- `GET /api/transactions/{id}/` - Obter transação
- `PUT /api/transactions/{id}/` - Atualizar transação
- `DELETE /api/transactions/{id}/` - Deletar transação
- `GET /api/transactions/summary/` - Resumo de transações
- `GET /api/transactions/by_date_range/` - Transações por intervalo de datas

## 🔍 Exemplos de Requisições

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo@example.com",
    "password": "demo123456"
  }'
```

### Listar Transações

```bash
curl -X GET http://localhost:8000/api/transactions/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Criar Transação

```bash
curl -X POST http://localhost:8000/api/transactions/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Compras no supermercado",
    "amount": "150.50",
    "type": "expense",
    "category": "CATEGORY_ID",
    "transaction_date": "2024-02-24"
  }'
```

### Obter Resumo

```bash
curl -X GET "http://localhost:8000/api/transactions/summary/?start_date=2024-01-01&end_date=2024-02-24" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🎨 Funcionalidades

### Backend

- ✅ Autenticação com JWT
- ✅ Isolamento multi-tenant
- ✅ CRUD de usuários e tenants
- ✅ CRUD de categorias
- ✅ CRUD de transações
- ✅ Filtros dinâmicos por data, categoria, tipo
- ✅ Resumo de transações (totais, por categoria, por mês)
- ✅ Seed data com dados de teste
- ✅ Middleware para isolamento de dados

### Frontend

- ✅ Página de login
- ✅ Dashboard com resumo financeiro
- ✅ Listagem de transações com filtros
- ✅ Criar nova transação
- ✅ Deletar transação
- ✅ Autenticação com JWT
- ✅ Interceptor de requisições
- ✅ Renovação automática de token
- ✅ Responsive design com Tailwind CSS

## 🔐 Segurança

- Autenticação JWT com tokens de acesso e refresh
- Isolamento de dados por tenant
- Middleware para validação de tenant
- CORS configurado
- Senhas com hash (Django)
- Validação de entrada em serializers

## 📊 Modelo de Dados

### Tenant
- id (UUID)
- name
- slug
- description
- cnpj
- email
- phone
- is_active
- created_at
- updated_at

### User
- id (UUID)
- tenant (FK)
- username
- email
- first_name
- last_name
- phone
- avatar
- bio
- is_verified
- preferred_currency
- created_at
- updated_at

### Category
- id (UUID)
- tenant (FK)
- name
- description
- type (income/expense)
- color
- icon
- is_active
- created_at
- updated_at

### Transaction
- id (UUID)
- tenant (FK)
- user (FK)
- description
- amount
- type (income/expense)
- category (FK)
- transaction_date
- due_date
- status (pending/completed/cancelled)
- notes
- is_recurring
- recurrence_type
- created_at
- updated_at

## 🚀 Deploy

### Backend (Heroku/Railway)

1. Adicionar Procfile
2. Configurar variáveis de ambiente
3. Deploy

### Frontend (Vercel/Netlify)

1. Build: `npm run build`
2. Deploy a pasta `dist/`

## 📝 Próximos Passos

- [ ] Autenticação com OAuth (Google, GitHub)
- [ ] Integração com APIs de cotações (yfinance, Brapi)
- [ ] Chatbot com processamento de linguagem natural
- [ ] Relatórios em PDF
- [ ] Notificações por email
- [ ] Integração com banco de dados (MySQL)
- [ ] Testes unitários e integração
- [ ] CI/CD com GitHub Actions

## 📄 Licença

MIT

## 👨‍💻 Autor

Desenvolvido como MVP de SaaS de Gestão Financeira.

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
