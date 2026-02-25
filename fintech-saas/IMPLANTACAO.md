# 📖 Manual de Implantação - FinManager SaaS

Guia completo para importar, configurar e executar o sistema de Gestão Financeira no VSCode.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Importar no VSCode](#importar-no-vscode)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Configuração do Backend](#configuração-do-backend)
5. [Configuração do Frontend](#configuração-do-frontend)
6. [Executar o Sistema](#executar-o-sistema)
7. [Guia de Uso](#guia-de-uso)
8. [Endpoints da API](#endpoints-da-api)
9. [Troubleshooting](#troubleshooting)
10. [Dicas e Boas Práticas](#dicas-e-boas-práticas)

---

## 🔧 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

### Softwares Necessários

| Software | Versão | Download |
|----------|--------|----------|
| **Python** | 3.10+ | https://www.python.org/downloads/ |
| **Node.js** | 16+ | https://nodejs.org/en/ |
| **Git** | 2.30+ | https://git-scm.com/ |
| **VSCode** | Última | https://code.visualstudio.com/ |
| **pip** | Incluído no Python | - |
| **npm** | Incluído no Node.js | - |

### Verificar Instalação

Abra o terminal e execute:

```bash
# Verificar Python
python --version
# Esperado: Python 3.10.x ou superior

# Verificar Node.js
node --version
# Esperado: v16.x.x ou superior

# Verificar npm
npm --version
# Esperado: 8.x.x ou superior

# Verificar Git
git --version
# Esperado: git version 2.30.x ou superior
```

### Extensões Recomendadas do VSCode

1. **Python** - Microsoft
2. **Pylance** - Microsoft
3. **Django** - Baptiste Darthenay
4. **ES7+ React/Redux/React-Native snippets** - dsznajder.es7-react-js-snippets
5. **Prettier - Code formatter** - Prettier
6. **Thunder Client** ou **REST Client** - Para testar API
7. **Tailwind CSS IntelliSense** - Bradleys

---

## 📁 Importar no VSCode

### Opção 1: Abrir Pasta Existente

1. Abra o VSCode
2. Clique em **File → Open Folder**
3. Navegue até `/home/ubuntu/fintech-saas`
4. Clique em **Select Folder**

### Opção 2: Usar Terminal

```bash
# Abrir Backend
code /home/ubuntu/fintech-saas

# Em outra janela, abrir Frontend
code /home/ubuntu/fintech-web
```

### Opção 3: Workspace (Recomendado)

Crie um arquivo `fintech.code-workspace`:

```json
{
  "folders": [
    {
      "path": "/home/ubuntu/fintech-saas",
      "name": "Backend (Django)"
    },
    {
      "path": "/home/ubuntu/fintech-web",
      "name": "Frontend (React)"
    }
  ],
  "settings": {
    "python.defaultInterpreterPath": "${workspaceFolder:Backend (Django)}/venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

Depois abra com: **File → Open Workspace from File**

---

## 📂 Estrutura do Projeto

```
fintech-saas/                          # Backend Django
├── config/                            # Configurações
│   ├── settings.py                   # Variáveis de ambiente
│   ├── urls.py                       # Rotas da API
│   ├── middleware.py                 # Isolamento multi-tenant
│   └── wsgi.py
├── accounts/                          # App de Autenticação
│   ├── models.py                     # Tenant, User
│   ├── serializers.py                # Serialização JSON
│   ├── views.py                      # Endpoints de auth
│   ├── migrations/
│   └── management/commands/
│       └── seed_data.py              # Popular banco
├── finance/                           # App de Finanças
│   ├── models.py                     # Category, Transaction
│   ├── serializers.py                # Serialização JSON
│   ├── views.py                      # Endpoints de transações
│   └── migrations/
├── manage.py                          # CLI do Django
├── db.sqlite3                         # Banco de dados
├── requirements.txt                   # Dependências Python
├── README.md                          # Documentação
└── IMPLANTACAO.md                     # Este arquivo

fintech-web/                           # Frontend React
├── src/
│   ├── components/                   # Componentes reutilizáveis
│   │   └── ProtectedRoute.jsx        # Proteção de rotas
│   ├── pages/                        # Páginas da aplicação
│   │   ├── Login.jsx                 # Tela de login
│   │   ├── Dashboard.jsx             # Resumo financeiro
│   │   ├── Transactions.jsx          # Lista de transações
│   │   └── NewTransaction.jsx        # Criar transação
│   ├── services/                     # Serviços de API
│   │   ├── api.js                    # Configuração Axios
│   │   ├── auth.js                   # Autenticação
│   │   └── transactions.js           # Transações
│   ├── styles/
│   │   └── index.css                 # Tailwind CSS
│   ├── App.jsx                       # Componente raiz
│   └── main.jsx                      # Entrada da app
├── index.html                         # HTML principal
├── package.json                       # Dependências Node
├── vite.config.js                    # Configuração Vite
├── tailwind.config.js                # Configuração Tailwind
└── postcss.config.js                 # Configuração PostCSS
```

---

## ⚙️ Configuração do Backend

### Passo 1: Abrir Terminal no VSCode

1. Pressione **Ctrl + `** (backtick) para abrir o terminal integrado
2. Ou vá em **Terminal → New Terminal**

### Passo 2: Navegar para Backend

```bash
cd /home/ubuntu/fintech-saas
```

### Passo 3: Criar Virtual Environment (Opcional mas Recomendado)

```bash
# Criar venv
python -m venv venv

# Ativar venv (Linux/Mac)
source venv/bin/activate

# Ativar venv (Windows)
venv\Scripts\activate
```

### Passo 4: Instalar Dependências

```bash
# Atualizar pip
pip install --upgrade pip

# Instalar dependências
pip install -r requirements.txt
```

**Saída esperada:**
```
Successfully installed Django-4.2.10 djangorestframework-3.14.0 ...
```

### Passo 5: Aplicar Migrations

```bash
python manage.py migrate
```

**Saída esperada:**
```
Operations to perform:
  Apply all migrations: admin, auth, accounts, finance, sessions
Running migrations:
  Applying accounts.0001_initial... OK
  Applying finance.0001_initial... OK
  ...
```

### Passo 6: Popular Banco com Dados de Teste

```bash
python manage.py seed_data
```

**Saída esperada:**
```
Iniciando seed data...
✓ Tenant criado: Demo Company
✓ Usuário criado: demo@example.com
✓ Categoria criada: Salário
✓ Categoria criada: Alimentação
...
✓ Seed data concluído com sucesso!

Credenciais de teste:
Email: demo@example.com
Senha: demo123456
Tenant: demo
```

### Passo 7: Criar Superusuário (Opcional)

Para acessar o admin do Django:

```bash
python manage.py createsuperuser
```

Responda as perguntas:
```
Username: admin
Email: admin@example.com
Password: ••••••••
Password (again): ••••••••
```

---

## ⚙️ Configuração do Frontend

### Passo 1: Abrir Novo Terminal

Pressione **Ctrl + Shift + `** para abrir novo terminal

### Passo 2: Navegar para Frontend

```bash
cd /home/ubuntu/fintech-web
```

### Passo 3: Instalar Dependências

```bash
npm install
```

**Saída esperada:**
```
added 158 packages in 15s
```

### Passo 4: Verificar Instalação

```bash
npm list react react-dom axios react-router-dom
```

---

## 🚀 Executar o Sistema

### Opção 1: Dois Terminais Separados (Recomendado)

#### Terminal 1 - Backend Django

```bash
cd /home/ubuntu/fintech-saas

# Se usar venv
source venv/bin/activate

# Iniciar servidor
python manage.py runserver
```

**Saída esperada:**
```
Watching for file changes with StatReloader
Performing system checks...
System check identified no issues (0 silenced).
February 24, 2026 - 23:25:40
Django version 4.2.10, using settings 'config.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

#### Terminal 2 - Frontend React

```bash
cd /home/ubuntu/fintech-web

# Iniciar servidor
npm run dev
```

**Saída esperada:**
```
VITE v5.0.8  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Opção 2: Usar Scripts de Inicialização

**Criar `start.sh` (Linux/Mac):**

```bash
#!/bin/bash

# Terminal 1 - Backend
cd /home/ubuntu/fintech-saas
source venv/bin/activate
python manage.py runserver &

# Terminal 2 - Frontend
cd /home/ubuntu/fintech-web
npm run dev &

wait
```

Executar:
```bash
chmod +x start.sh
./start.sh
```

### Opção 3: Usar VSCode Tasks

Crie `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Backend Django",
      "type": "shell",
      "command": "python",
      "args": ["manage.py", "runserver"],
      "cwd": "${workspaceFolder:Backend (Django)}",
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": "^.*$",
          "file": 1,
          "location": 2,
          "message": 3
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^.*Starting development server.*",
          "endsPattern": "^.*quit the server.*"
        }
      }
    },
    {
      "label": "Frontend React",
      "type": "shell",
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "${workspaceFolder:Frontend (React)}",
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": "^.*$",
          "file": 1,
          "location": 2,
          "message": 3
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^.*ready in.*",
          "endsPattern": "^.*press h to show help.*"
        }
      }
    }
  ],
  "runOrder": "parallel"
}
```

Depois execute: **Terminal → Run Task → Backend Django** e **Frontend React**

---

## 📖 Guia de Uso

### 1️⃣ Acessar a Aplicação

Abra o navegador e acesse:

```
http://localhost:5173
```

### 2️⃣ Fazer Login

Na tela de login, use:

- **Email**: demo@example.com
- **Senha**: demo123456

Clique em **Entrar**

### 3️⃣ Dashboard

Após login, você verá:

- **Receitas**: Total de entradas (R$ 5.000,00)
- **Despesas**: Total de saídas (R$ 2.640,90)
- **Saldo**: Diferença (R$ 2.359,10)
- **Principais Categorias**: Gráfico com categorias

### 4️⃣ Visualizar Transações

Clique em **Ver Transações** para:

- Listar todas as transações
- Filtrar por tipo (receita/despesa)
- Filtrar por categoria
- Filtrar por data
- Deletar transações

### 5️⃣ Criar Nova Transação

Clique em **Nova Transação** para:

1. Escolher tipo (Receita ou Despesa)
2. Preencher descrição
3. Informar valor
4. Selecionar categoria
5. Escolher data
6. Adicionar notas (opcional)
7. Clicar em **Salvar Transação**

### 6️⃣ Fazer Logout

Clique em **Sair** no canto superior direito

---

## 🔌 Endpoints da API

### Autenticação

#### Login
```
POST /api/auth/login/
Content-Type: application/json

{
  "username": "demo@example.com",
  "password": "demo123456"
}

Resposta (200):
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "demo@example.com",
    "first_name": "Demo",
    "tenant": {...}
  }
}
```

#### Renovar Token
```
POST /api/auth/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Resposta (200):
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Usuários

#### Obter Usuário Atual
```
GET /api/users/me/
Authorization: Bearer {access_token}

Resposta (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "demo",
  "email": "demo@example.com",
  "first_name": "Demo",
  "last_name": "User",
  "tenant": {...}
}
```

#### Registrar Novo Usuário
```
POST /api/users/register/
Content-Type: application/json

{
  "email": "novo@example.com",
  "password": "senha123456",
  "password_confirm": "senha123456",
  "first_name": "Novo",
  "last_name": "Usuário",
  "tenant_slug": "demo"
}

Resposta (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "novo@example.com",
  ...
}
```

### Categorias

#### Listar Categorias
```
GET /api/categories/
Authorization: Bearer {access_token}

Resposta (200):
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "name": "Salário",
      "type": "income",
      "icon": "💰",
      "color": "#10B981"
    },
    ...
  ]
}
```

#### Categorias por Tipo
```
GET /api/categories/by_type/
Authorization: Bearer {access_token}

Resposta (200):
{
  "income": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "name": "Salário",
      "type": "income",
      "icon": "💰",
      "color": "#10B981"
    }
  ],
  "expense": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "name": "Alimentação",
      "type": "expense",
      "icon": "🍔",
      "color": "#EF4444"
    }
  ]
}
```

### Transações

#### Listar Transações
```
GET /api/transactions/
Authorization: Bearer {access_token}

Query Parameters:
- type: income | expense
- category: {category_id}
- transaction_date: YYYY-MM-DD
- page: {page_number}

Resposta (200):
{
  "count": 8,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "description": "Salário mensal",
      "amount": "5000.00",
      "type": "income",
      "category": "550e8400-e29b-41d4-a716-446655440010",
      "category_name": "Salário",
      "transaction_date": "2024-02-24",
      "status": "completed"
    },
    ...
  ]
}
```

#### Criar Transação
```
POST /api/transactions/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "Compras no supermercado",
  "amount": "150.50",
  "type": "expense",
  "category": "550e8400-e29b-41d4-a716-446655440020",
  "transaction_date": "2024-02-24",
  "notes": "Compras semanais"
}

Resposta (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440101",
  "description": "Compras no supermercado",
  "amount": "150.50",
  "type": "expense",
  "category": "550e8400-e29b-41d4-a716-446655440020",
  "transaction_date": "2024-02-24",
  "status": "completed"
}
```

#### Obter Resumo
```
GET /api/transactions/summary/
Authorization: Bearer {access_token}

Query Parameters:
- start_date: YYYY-MM-DD
- end_date: YYYY-MM-DD

Resposta (200):
{
  "total_income": 5000.00,
  "total_expense": 2640.90,
  "balance": 2359.10,
  "transaction_count": 8,
  "by_category": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "name": "Alimentação",
      "type": "expense",
      "total": 335.50,
      "icon": "🍔",
      "color": "#EF4444"
    }
  ],
  "by_month": [
    {
      "year": 2024,
      "month": 2,
      "income": 5000.00,
      "expense": 2640.90,
      "balance": 2359.10
    }
  ]
}
```

#### Deletar Transação
```
DELETE /api/transactions/{id}/
Authorization: Bearer {access_token}

Resposta (204):
(sem conteúdo)
```

---

## 🔍 Testando a API

### Opção 1: Usar Thunder Client (VSCode)

1. Instale a extensão **Thunder Client**
2. Clique no ícone de raio na barra lateral
3. Clique em **New Request**
4. Configure:
   - **Method**: POST
   - **URL**: http://localhost:8000/api/auth/login/
   - **Body** (JSON):
     ```json
     {
       "username": "demo@example.com",
       "password": "demo123456"
     }
     ```
5. Clique em **Send**

### Opção 2: Usar cURL no Terminal

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo@example.com",
    "password": "demo123456"
  }'

# Copiar o token de acesso da resposta

# Listar transações
curl -X GET http://localhost:8000/api/transactions/ \
  -H "Authorization: Bearer {seu_token_aqui}"
```

### Opção 3: Usar Postman

1. Baixe o Postman: https://www.postman.com/downloads/
2. Crie uma nova requisição
3. Configure como acima
4. Use o token nas próximas requisições

---

## 🐛 Troubleshooting

### Problema: "ModuleNotFoundError: No module named 'django'"

**Solução:**
```bash
# Verificar se venv está ativado
source venv/bin/activate

# Reinstalar dependências
pip install -r requirements.txt
```

### Problema: "Port 8000 is already in use"

**Solução:**
```bash
# Usar outra porta
python manage.py runserver 8001

# Ou matar processo na porta 8000
# Linux/Mac
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID {PID} /F
```

### Problema: "Port 5173 is already in use"

**Solução:**
```bash
# Usar outra porta
npm run dev -- --port 5174
```

### Problema: "CORS error" no console do navegador

**Solução:**
Verificar se o backend está rodando em http://localhost:8000

```bash
# Verificar se Django está rodando
curl http://localhost:8000/api/auth/login/
```

### Problema: "Token inválido" ao fazer login

**Solução:**
```bash
# Limpar localStorage do navegador
# Abrir DevTools (F12)
# Console > localStorage.clear()
# Recarregar página
```

### Problema: "Database locked" no SQLite

**Solução:**
```bash
# Remover arquivo de lock
rm db.sqlite3-journal

# Ou recriar banco
rm db.sqlite3
python manage.py migrate
python manage.py seed_data
```

### Problema: "npm install" muito lento

**Solução:**
```bash
# Usar npm cache clean
npm cache clean --force

# Ou usar yarn
npm install -g yarn
yarn install
```

### Problema: Transações não aparecem após criar

**Solução:**
1. Verificar se o token está válido
2. Abrir DevTools (F12) → Network
3. Verificar se a requisição POST retorna 201
4. Recarregar página com F5

---

## 💡 Dicas e Boas Práticas

### 1. Usar Virtual Environment

Sempre use venv para isolar dependências:

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

### 2. Salvar Dependências

Após instalar novo pacote:

```bash
pip freeze > requirements.txt
```

### 3. Usar .env para Variáveis Sensíveis

Crie `.env` no backend:

```env
SECRET_KEY=sua-chave-secreta
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

Depois use:

```python
from decouple import config

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', cast=bool)
```

### 4. Logs Úteis

Para debug, adicione prints no código:

```python
# Backend
print(f"DEBUG: {variavel}")

# Frontend
console.log("DEBUG:", variavel);
```

### 5. Resetar Banco de Dados

Se precisar recomeçar:

```bash
# Deletar banco
rm db.sqlite3

# Recriar
python manage.py migrate
python manage.py seed_data
```

### 6. Verificar Status do Servidor

```bash
# Backend
curl http://localhost:8000/api/auth/login/

# Frontend
curl http://localhost:5173/
```

### 7. Usar Git para Controle de Versão

```bash
# Inicializar repositório
git init

# Adicionar arquivos
git add .

# Fazer commit
git commit -m "Inicial: FinManager SaaS"

# Ver histórico
git log
```

### 8. Estrutura de Pastas Limpa

Manter organização:

```
fintech-saas/
├── .gitignore          # Arquivos ignorados
├── .env                # Variáveis de ambiente
├── venv/               # Virtual environment
├── config/             # Configurações
├── accounts/           # App de autenticação
├── finance/            # App de finanças
└── manage.py
```

### 9. Comandos Úteis do Django

```bash
# Criar app
python manage.py startapp nova_app

# Fazer migrations
python manage.py makemigrations

# Aplicar migrations
python manage.py migrate

# Shell interativo
python manage.py shell

# Criar superusuário
python manage.py createsuperuser

# Admin
python manage.py runserver
# Acesse: http://localhost:8000/admin
```

### 10. Comandos Úteis do React

```bash
# Instalar pacote
npm install nome-pacote

# Remover pacote
npm uninstall nome-pacote

# Atualizar pacotes
npm update

# Limpar cache
npm cache clean --force

# Build para produção
npm run build

# Preview de build
npm run preview
```

---

## 📞 Suporte e Contato

Se encontrar problemas:

1. Verificar a seção [Troubleshooting](#troubleshooting)
2. Consultar logs do terminal
3. Abrir DevTools do navegador (F12)
4. Verificar console do VSCode

---

## 📝 Checklist de Implementação

- [ ] Python 3.10+ instalado
- [ ] Node.js 16+ instalado
- [ ] VSCode instalado com extensões
- [ ] Backend clonado em `/home/ubuntu/fintech-saas`
- [ ] Frontend clonado em `/home/ubuntu/fintech-web`
- [ ] Virtual environment criado
- [ ] Dependências instaladas (pip + npm)
- [ ] Migrations aplicadas
- [ ] Seed data criado
- [ ] Backend rodando em http://localhost:8000
- [ ] Frontend rodando em http://localhost:5173
- [ ] Login funcionando com demo@example.com
- [ ] Dashboard exibindo dados
- [ ] Transações listando corretamente
- [ ] Criar transação funcionando
- [ ] Deletar transação funcionando

---

## 🎉 Conclusão

Parabéns! Você agora tem um sistema completo de Gestão Financeira rodando localmente!

### Próximos Passos

1. Explorar o código-fonte
2. Fazer modificações e testes
3. Adicionar novas funcionalidades
4. Fazer deploy em produção

Boa sorte! 🚀

---

**Versão**: 1.0  
**Data**: Fevereiro 2024  
**Autor**: FinManager Development Team
