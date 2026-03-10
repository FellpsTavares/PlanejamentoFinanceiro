# 📖 Manual de Implantação - Elo Financeiro Frontend

Guia completo para importar, configurar e executar o Frontend React no VSCode.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Importar no VSCode](#importar-no-vscode)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Instalação](#instalação)
5. [Configuração](#configuração)
6. [Executar](#executar)
7. [Guia de Uso](#guia-de-uso)
8. [Estrutura de Componentes](#estrutura-de-componentes)
9. [Troubleshooting](#troubleshooting)
10. [Deploy](#deploy)

---

## 🔧 Pré-requisitos

### Softwares Necessários

| Software | Versão | Status |
|----------|--------|--------|
| **Node.js** | 16+ | ✅ Obrigatório |
| **npm** | 8+ | ✅ Incluído no Node.js |
| **VSCode** | Última | ✅ Recomendado |
| **Git** | 2.30+ | ✅ Opcional |

### Verificar Instalação

```bash
# Verificar Node.js
node --version
# Esperado: v16.x.x ou superior

# Verificar npm
npm --version
# Esperado: 8.x.x ou superior
```

### Extensões do VSCode (Recomendadas)

- **ES7+ React/Redux/React-Native snippets** - dsznajder.es7-react-js-snippets
- **Prettier - Code formatter** - esbenp.prettier-vscode
- **Tailwind CSS IntelliSense** - bradleys.vscode-tailwindcss
- **Thunder Client** - rangav.vscode-thunder-client
- **REST Client** - humao.rest-client

---

## 📁 Importar no VSCode

### Passo 1: Abrir Pasta

1. Abra o VSCode
2. **File → Open Folder**
3. Navegue até `/home/ubuntu/fintech-web`
4. Clique em **Select Folder**

### Passo 2: Confiar no Workspace

Se aparecer uma mensagem, clique em **Trust**

### Passo 3: Abrir Terminal

Pressione **Ctrl + `** para abrir o terminal integrado

---

## 📂 Estrutura do Projeto

```
fintech-web/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.jsx          # Proteção de rotas autenticadas
│   ├── pages/
│   │   ├── Login.jsx                   # Tela de login
│   │   ├── Dashboard.jsx               # Dashboard com resumo
│   │   ├── Transactions.jsx            # Lista de transações
│   │   └── NewTransaction.jsx          # Criar transação
│   ├── services/
│   │   ├── api.js                      # Configuração Axios
│   │   ├── auth.js                     # Serviço de autenticação
│   │   └── transactions.js             # Serviço de transações
│   ├── styles/
│   │   └── index.css                   # Tailwind CSS global
│   ├── App.jsx                         # Componente raiz com rotas
│   └── main.jsx                        # Entrada da aplicação
├── index.html                          # HTML principal
├── package.json                        # Dependências e scripts
├── vite.config.js                      # Configuração Vite
├── tailwind.config.js                  # Configuração Tailwind CSS
├── postcss.config.js                   # Configuração PostCSS
├── .gitignore                          # Arquivos ignorados pelo Git
└── IMPLANTACAO.md                      # Este arquivo
```

---

## ⚙️ Instalação

### Passo 1: Instalar Dependências

No terminal, execute:

```bash
npm install
```

**Saída esperada:**
```
added 158 packages, and audited 159 packages in 15s
```

### Passo 2: Verificar Instalação

```bash
npm list react react-dom axios react-router-dom
```

**Saída esperada:**
```
fintech-web@0.0.1
├── axios@1.6.2
├── react@18.2.0
├── react-dom@18.2.0
└── react-router-dom@6.20.0
```

### Passo 3: Limpar Cache (Se Necessário)

```bash
npm cache clean --force
```

---

## ⚙️ Configuração

### Passo 1: Verificar Arquivo de Configuração

Abra `vite.config.js` e verifique:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### Passo 2: Configurar Variáveis de Ambiente (Opcional)

Crie arquivo `.env`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Elo Financeiro
```

Depois use no código:

```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

### Passo 3: Verificar Tailwind CSS

Abra `tailwind.config.js`:

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

---

## 🚀 Executar

### Passo 1: Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

**Saída esperada:**
```
VITE v5.0.8  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Passo 2: Abrir no Navegador

Clique no link ou abra manualmente:

```
http://localhost:5173
```

### Passo 3: Verificar Se Está Funcionando

- Você deve ver a tela de login
- Se vir erro de conexão, verifique se o backend está rodando

---

## 📖 Guia de Uso

### 1. Fazer Login

**Tela de Login**

```
Email: demo@example.com
Senha: demo123456
```

Clique em **Entrar**

### 2. Dashboard

Após login, você verá:

- **Receitas**: Total de entradas
- **Despesas**: Total de saídas
- **Saldo**: Diferença
- **Principais Categorias**: Lista com ícones e valores

Botões:
- **Ver Transações**: Ir para listagem
- **Nova Transação**: Criar transação

### 3. Listagem de Transações

**Filtros disponíveis:**

- **Tipo**: Receita / Despesa / Todos
- **Categoria**: Selecionar categoria
- **Data Inicial**: Filtrar a partir de
- **Data Final**: Filtrar até

**Ações:**

- Clicar em **Aplicar Filtros** para filtrar
- Clicar em **Deletar** para remover transação
- Clicar em **Nova Transação** para criar

### 4. Criar Transação

**Preencher formulário:**

1. **Tipo**: Escolher Receita ou Despesa
2. **Descrição**: Ex: "Salário mensal"
3. **Valor**: Ex: "5000.00"
4. **Categoria**: Selecionar categoria
5. **Data**: Escolher data
6. **Notas**: Adicionar observações (opcional)

Clique em **Salvar Transação**

### 5. Fazer Logout

Clique em **Sair** no canto superior direito

---

## 🏗️ Estrutura de Componentes

### Componente: ProtectedRoute

Protege rotas que requerem autenticação:

```jsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### Página: Login

- Formulário com email e senha
- Credenciais de teste pré-preenchidas
- Tratamento de erros
- Redirecionamento após login

### Página: Dashboard

- Cartões com resumo financeiro
- Lista de categorias principais
- Botões de ação (Ver Transações, Nova Transação)
- Logout

### Página: Transactions

- Filtros avançados
- Tabela com transações
- Ação de deletar
- Paginação

### Página: NewTransaction

- Formulário com validação
- Seleção de categoria dinâmica
- Tratamento de erros
- Redirecionamento após sucesso

### Serviço: api.js

Configuração do Axios com:

- Interceptor de requisição (adiciona token)
- Interceptor de resposta (trata 401)
- Renovação automática de token

### Serviço: auth.js

Funções de autenticação:

- `login()` - Fazer login
- `logout()` - Fazer logout
- `register()` - Registrar usuário
- `getCurrentUser()` - Obter usuário atual
- `isAuthenticated()` - Verificar autenticação

### Serviço: transactions.js

Funções de transações:

- `list()` - Listar transações
- `get()` - Obter transação
- `create()` - Criar transação
- `update()` - Atualizar transação
- `delete()` - Deletar transação
- `getSummary()` - Obter resumo
- `getByDateRange()` - Filtrar por data

---

## 🐛 Troubleshooting

### Problema: "npm: command not found"

**Solução:**
```bash
# Instalar Node.js
# https://nodejs.org/

# Verificar instalação
node --version
npm --version
```

### Problema: "Port 5173 already in use"

**Solução:**
```bash
# Usar outra porta
npm run dev -- --port 5174

# Ou matar processo
# Linux/Mac
lsof -ti:5173 | xargs kill -9

# Windows
netstat -ano | findstr :5173
taskkill /PID {PID} /F
```

### Problema: "Cannot find module 'react'"

**Solução:**
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Problema: "CORS error" no console

**Solução:**

1. Verificar se backend está rodando:
   ```bash
   curl http://localhost:8000/api/auth/login/
   ```

2. Se não estiver, iniciar backend:
   ```bash
   cd /home/ubuntu/fintech-saas
   python manage.py runserver
   ```

### Problema: "Token inválido" ao fazer login

**Solução:**

1. Abrir DevTools (F12)
2. Ir em **Application → Local Storage**
3. Deletar `access_token` e `refresh_token`
4. Recarregar página
5. Fazer login novamente

### Problema: Transações não aparecem

**Solução:**

1. Abrir DevTools (F12)
2. Ir em **Network**
3. Fazer login
4. Verificar requisição para `/api/transactions/`
5. Verificar se retorna status 200
6. Verificar JSON da resposta

### Problema: Estilos Tailwind não aparecem

**Solução:**

1. Verificar se `index.css` está importado em `main.jsx`
2. Verificar se `tailwind.config.js` está correto
3. Limpar cache do navegador (Ctrl + Shift + Delete)
4. Reiniciar servidor (Ctrl + C e npm run dev)

### Problema: npm install muito lento

**Solução:**

```bash
# Limpar cache
npm cache clean --force

# Usar npm ci (mais rápido)
npm ci

# Ou usar yarn
npm install -g yarn
yarn install
```

---

## 🚀 Deploy

### Build para Produção

```bash
npm run build
```

Cria pasta `dist/` com arquivos otimizados

### Preview do Build

```bash
npm run preview
```

Abre em http://localhost:4173

### Deploy no Vercel

1. Instalar Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Seguir instruções

### Deploy no Netlify

1. Instalar Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Deploy:
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Deploy no GitHub Pages

1. Instalar gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Adicionar ao `package.json`:
   ```json
   {
     "homepage": "https://seu-usuario.github.io/fintech-web",
     "scripts": {
       "deploy": "npm run build && gh-pages -d dist"
     }
   }
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

---

## 📊 Estrutura de Dados

### Usuário (localStorage)

```javascript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "demo",
  "email": "demo@example.com",
  "first_name": "Demo",
  "last_name": "User",
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Demo Company",
    "slug": "demo"
  }
}
```

### Transação

```javascript
{
  "id": "550e8400-e29b-41d4-a716-446655440100",
  "description": "Salário mensal",
  "amount": "5000.00",
  "type": "income",
  "category": "550e8400-e29b-41d4-a716-446655440010",
  "category_name": "Salário",
  "category_icon": "💰",
  "category_color": "#10B981",
  "transaction_date": "2024-02-24",
  "status": "completed",
  "created_at": "2024-02-24T10:30:00Z"
}
```

### Categoria

```javascript
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "name": "Salário",
  "type": "income",
  "icon": "💰",
  "color": "#10B981",
  "is_active": true
}
```

---

## 💡 Dicas Úteis

### 1. Usar Prettier para Formatar Código

```bash
# Formatar todos os arquivos
npx prettier --write src/
```

### 2. Usar ESLint para Verificar Código

```bash
# Instalar
npm install --save-dev eslint eslint-plugin-react

# Verificar
npx eslint src/
```

### 3. Adicionar Novo Componente

```bash
# Criar arquivo
touch src/components/MeuComponente.jsx

# Estrutura básica
export default function MeuComponente() {
  return (
    <div>
      Meu Componente
    </div>
  );
}
```

### 4. Adicionar Novo Serviço

```bash
# Criar arquivo
touch src/services/meuServico.js

# Estrutura básica
import api from './api';

export const meuServico = {
  listar: async () => {
    const response = await api.get('/endpoint/');
    return response.data;
  },
};
```

### 5. Usar React DevTools

1. Instalar extensão do Chrome
2. Abrir DevTools (F12)
3. Ir em **React** tab
4. Inspecionar componentes

### 6. Debugar com console.log

```javascript
// Frontend
console.log("DEBUG:", variavel);

// Ver no DevTools (F12 → Console)
```

### 7. Usar localStorage para Persistência

```javascript
// Salvar
localStorage.setItem('chave', JSON.stringify(valor));

// Obter
const valor = JSON.parse(localStorage.getItem('chave'));

// Deletar
localStorage.removeItem('chave');

// Limpar tudo
localStorage.clear();
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar [Troubleshooting](#troubleshooting)
2. Abrir DevTools (F12)
3. Verificar console de erros
4. Verificar Network tab
5. Verificar se backend está rodando

---

## ✅ Checklist

- [ ] Node.js 16+ instalado
- [ ] npm instalado
- [ ] VSCode instalado
- [ ] Pasta `/home/ubuntu/fintech-web` aberta
- [ ] `npm install` executado
- [ ] Backend rodando em http://localhost:8000
- [ ] `npm run dev` executado
- [ ] Frontend abrindo em http://localhost:5173
- [ ] Login funcionando
- [ ] Dashboard exibindo dados
- [ ] Transações listando
- [ ] Criar transação funcionando
- [ ] Deletar transação funcionando

---

## 🎉 Conclusão

Parabéns! Seu frontend está pronto para usar!

### Próximos Passos

1. Explorar o código
2. Fazer modificações
3. Adicionar novos componentes
4. Fazer deploy

Boa sorte! 🚀

---

**Versão**: 1.0  
**Data**: Fevereiro 2024  
**Autor**: Elo Financeiro Development Team
