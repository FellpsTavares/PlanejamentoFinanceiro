# Elo Financeiro — PlanejamentoFinanceiro

> **Slogan:** Conectando a sua empresa à eficiência.

Sistema SaaS multi-tenant de gestão financeira empresarial com módulos de Financeiro, Transportadora e Investimentos.

---

## Sumário

- [Arquitetura Geral](#arquitetura-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Módulos e Funcionalidades](#módulos-e-funcionalidades)
- [Frontend: Ferramentas e Funções Principais](#frontend-ferramentas-e-funções-principais)
- [Backend: Ferramentas e Funções Principais](#backend-ferramentas-e-funções-principais)
- [Autenticação e Autorização](#autenticação-e-autorização)
- [Infraestrutura e Deploy](#infraestrutura-e-deploy)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Convenções e Regras](#convenções-e-regras)

---

## Últimas alterações (desde v1.0.4)

- Corrigido comportamento de formatação numérica: `normalizeInputDecimal` e `formatQuantityDisplay` para entrada/visualização BR (vírgula decimal) e evitar perda de precisão.
- Adicionado `no_page` em endpoints de listagem de viagens (backend) e suporte no frontend para requisições não-paginadas quando necessário (relatórios e dashboards).
- Ajustes de UX/Frontend:
  - Seção de Viagens removida do perfil do veículo quando exibido (opção de visualizar/abrir viagens ocultada).
  - Formulário "Editar veículo" convertido para painel expansível (accordion) no perfil do veículo.
  - Home: ocultado badge com chave do módulo e contador "Variáveis disponíveis" (preservando botões e links do cartão).
  - Adicionado `LoadingOverlay` global para transições de tela mais suaves (overlay com logo + spinner, sem atrasar carregamento real).
  - Favicon atualizado com `public/logo/LogoHome.png` e suporte `apple-touch-icon`.
- Relatórios: campo `description` adicionado ao `transport_pdf` (backend + UI) para incluir descrição de viagens quando selecionado.
- Pequenas melhorias no `authService.getCurrentUser()` e normalização de flags (`has_module_transport`, `has_module_investments`) no frontend para evitar que strings 'false' apareçam como truthy.


---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                     Usuário (Browser)               │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────────┐
│              Nginx (elofinanceiro-web)               │
│  Serve dist/ do React e faz proxy /api → backend    │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP interno
┌───────────────────▼─────────────────────────────────┐
│           Gunicorn / Django (elofinanceiro-backend)  │
│  DRF REST API   │   JWT Auth   │   Multi-Tenant      │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│          PostgreSQL 16 (elofinanceiro-db)            │
└─────────────────────────────────────────────────────┘
```

- **Multi-tenant**: isolamento lógico por `request.user.tenant` em todas as queries.
- **Feature flags por tenant**: módulos Investimentos e Transportadora são ativados individualmente por tenant via campos `has_module_investments` e `has_module_transport` no modelo `Tenant`.

---

## Stack Tecnológica

### Backend (`fintech-saas`)

| Tecnologia | Versão / Uso |
|---|---|
| Python | 3.11 |
| Django | 4.2 |
| Django REST Framework | API RESTful |
| Simple JWT | Autenticação JWT (access + refresh token) |
| Gunicorn | Servidor WSGI em produção |
| PostgreSQL 16 | Banco de dados principal |
| python-decouple | Leitura de variáveis de ambiente via `.env` |
| yfinance / brapi | Cotações de ativos (módulo Investimentos) |
| WeasyPrint / ReportLab | Geração de relatórios PDF por módulo |

### Frontend (`fintech-web`)

| Tecnologia | Versão / Uso |
|---|---|
| React 18 | UI reativa via hooks |
| Vite 4 | Bundler e servidor de dev |
| Tailwind CSS | Utilitários de estilo |
| React Router v6 | Navegação SPA com rotas protegidas |
| Axios | Cliente HTTP com interceptors JWT |
| Cleave.js | Formatação de inputs monetários (CurrencyInput) |
| PostCSS | Processamento CSS |

---

## Estrutura do Projeto

```
PlanejamentoFinanceiro/
├── docker-compose.yml            # Produção (PostgreSQL + Gunicorn + Nginx + Certbot)
├── docker-compose.local.yml      # Desenvolvimento local
├── fintech-saas/                 # Backend Django
│   ├── accounts/                 # Tenant, User, permissões, auditoria
│   ├── finance/                  # Transações, categorias, formas de pagamento
│   ├── transport/                # Veículos, viagens, pneus, manutenção
│   ├── config/                   # settings.py, urls.py, middleware, wsgi/asgi
│   └── requirements.txt
└── fintech-web/                  # Frontend React
    ├── src/
    │   ├── components/           # Componentes reutilizáveis
    │   ├── pages/                # Páginas (uma por rota)
    │   ├── services/             # Camada de chamadas à API
    │   ├── utils/                # Utilitários de formatação e aritmética
    │   └── hooks/                # Custom hooks React
    ├── public/                   # Assets estáticos (logos, backgrounds)
    └── docker/nginx/             # Configurações Nginx HTTP/HTTPS
```

---

## Módulos e Funcionalidades

### Financeiro
- Cadastro e listagem de transações (receitas e despesas).
- Categorias com suporte a ícone emoji, gerenciadas em Configurações > Finanças.
- Formas de pagamento por tenant (`Dinheiro` e `PIX` garantidos automaticamente).
- Transações recorrentes e parceladas.
- Relatório PDF filtrado por período.

### Transportadora
- **Veículos**: cadastro com placa, modelo, ano, capacidade, KM inicial, número de eixos, rodagem simples ou dupla, datas de revisão.
- **KM atual**: calculado automaticamente como `max(km_inicial + soma_de_distâncias_das_viagens, último_km_final_de_viagem_encerrada)`.
- **Viagens** (`Trip`): ciclo de vida `in_progress` → `completed`, com modalidades **Por Tonelada** (`tons × rate_per_ton`) e **Arrendamento** (`days × daily_rate`).
- **Movimentações de viagem** (`TripMovement`): lançamentos incrementais de despesas (combustível, outros) e recebimentos durante a viagem; recalculam os totais automaticamente.
- **Pneus**: inventário (`TireInventory`) e posicionamento por eixo/lado/posição (`VehicleTirePlacement`); bloqueio de pneu duplicado em posições simultâneas; rodízio de pneus.
- **Manutenção e óleo**: registros via `MaintenanceLog` e `OilChangeLog`.
- **Alertas de revisão**: gerados por data-limite ou km-limite via comando `generate_review_alerts` e task assíncrona.
- Relatório PDF filtrado por veículo e período.

### Investimentos (módulo opcional)
- Gestão de carteira de ativos com cotações em tempo real via yfinance / brapi.
- Dashboard e recomendações.
- Relatório PDF filtrado por ticker e período.

### Configurações e Governança
- Parâmetros por módulo via `TenantParameter` (chave/valor por módulo: `general`, `finance`, `transport`).
- Auditoria de ações (`TenantAuditLog`) com filtros por módulo, ação, entidade, usuário e período.
- Gestão de usuários do tenant por perfil administrativo.
- Gestão de contas (superusuário): status `active`, `past_due`, `suspended`, `cancelled`; bloqueio automático de acesso em contas suspensas/canceladas.
- Self-signup: criação de conta (tenant + admin) via tela de login (`/users/register-account/`).

---

## Frontend: Ferramentas e Funções Principais

### `src/utils/format.js`

| Função | O que faz |
|---|---|
| `formatDecimalStringToBRL(value, decimals)` | Converte string decimal (ponto ou vírgula) em `R$ 1.234,56` para exibição |
| `formatDecimalString(value, decimals)` | Formata decimal em string BR sem o prefixo `R$` (ex: `1.234,56`) |
| `normalizeInputDecimal(value)` | Converte string BR (com pontos de milhar e vírgula decimal) em string com ponto decimal para aritmética e envio à API |
| `formatQuantityDisplay(value)` | Formata quantidade numérica para exibição em BR: inteiros sem decimais, decimais com vírgula e até 3 casas |

> **Padrão de entrada numérica:** o usuário digita com vírgula (BR). Os campos armazenam strings BR. No `handleSubmit`, `normalizeInputDecimal` converte para ponto antes de enviar à API.

### `src/utils/decimal.js`

Aritmética de precisão usando `BigInt` para evitar erros de ponto flutuante em cálculos financeiros.

| Função | O que faz |
|---|---|
| `multiplyDecimalStrings(a, b)` | Multiplica duas strings decimais (aceita vírgula) sem perda de precisão |
| `addDecimalStrings(a, b)` | Soma duas strings decimais |
| `subtractDecimalStrings(a, b)` | Subtrai `b` de `a`; suporta resultado negativo |
| `divideDecimalStringByInt(a, divisor)` | Divide string decimal por inteiro (trunca, sem arredondamento) |

### `src/services/api.js`

Instância Axios centralizada com:
- Base URL configurada por `VITE_API_URL` (fallback `/api`).
- **Interceptor de request**: injeta `Authorization: Bearer <access_token>` de `localStorage`.
- **Interceptor de response**: em 401, tenta renovar o token via `POST /auth/refresh/`; se falhar, limpa `localStorage` e redireciona para `/login`.

### `src/services/` — Camada de API

| Arquivo | Responsabilidade |
|---|---|
| `auth.js` | Login, logout, register, registerAccount, getMe, isAuthenticated, getCurrentUser, must_change_password |
| `transport.js` | CRUD de veículos, viagens, movimentações, pneus, manutenção, resumo de veículo |
| `transactions.js` | CRUD de transações financeiras |
| `tenantParameters.js` | Leitura e escrita de parâmetros por módulo |
| `tenantAudit.js` | Consulta de logs de auditoria com filtros |
| `tenantUsers.js` | Listagem e gerenciamento de usuários do tenant |
| `reports.js` | Download de PDFs por módulo |
| `investmentsMarket.js` | Cotações de mercado (yfinance/brapi) |
| `assistant.js` | Chat assistente (desativado; endpoint retorna 503) |

### `src/components/` — Componentes Reutilizáveis

| Componente | O que faz |
|---|---|
| `ProtectedRoute` | Verifica autenticação; redireciona para `/login`. Se `must_change_password`, redireciona para `/change-password`. Renderiza `Sidebar` + `AppHeader` ao redor das páginas. |
| `ModuleRoute` | Verifica se o tenant tem o feature flag do módulo (`has_module_investments`, `has_module_transport`); redireciona para `/dashboard` se não tiver. |
| `SuperUserRoute` | Restringe acesso a rotas de superusuário da plataforma. |
| `PlatformAdminRoute` | Restringe acesso a rotas de admin de plataforma. |
| `CurrencyInput` | Input monetário usando Cleave.js; separador de milhar `.`, decimal `,`, 2 casas decimais. |
| `ToastContainer` | Ouve o evento `app:toast` (disparado por `utils/toast.js`) e exibe notificações temporárias. |
| `ConfirmModal` | Modal de confirmação genérico (sim/não). |
| `TransportTripModal` | Modal rápido de edição de viagem com formatação BR dos campos numéricos. |
| `TransportEntryExpenseModal` | Modal para lançamento rápido de despesa/receita em viagem. |
| `ToggleChip` | Chip toggle reutilizável para filtros. |
| `Sidebar` | Barra lateral compacta com expansão em hover; identidade visual com logo oficial. |
| `AppHeader` | Cabeçalho com botão Home (logo) e menu do usuário. |

### `src/utils/toast.js`

Emite um `CustomEvent('app:toast', { detail: { message, type, ttl } })` que é capturado pelo `ToastContainer`. Desacoplado do React para poder ser chamado de qualquer lugar sem importar hooks.

---

## Backend: Ferramentas e Funções Principais

### `accounts/` — Multi-tenant e Usuários

| Modelo / Arquivo | Responsabilidade |
|---|---|
| `Tenant` | Empresa/organização; controla feature flags, status da conta (`active`, `past_due`, `suspended`, `cancelled`), vencimento e notas. `is_account_blocked()` retorna `True` para contas suspensas/canceladas. |
| `User` | Extends `AbstractUser`; campos extras: `tenant`, `role`, `is_platform_admin`, `must_change_password`. |
| `TenantParameter` | Parâmetros chave/valor por módulo. Usado para configurar comportamento de Transportadora, Finanças e Geral sem alterar código. |
| `TenantAuditLog` | Registro imutável de ações com campos: `tenant`, `user`, `action`, `entity_type`, `entity_id`, `details` (JSON). |
| `audit.log_tenant_action()` | Helper para persistir um `TenantAuditLog`; centraliza validação e truncamento de campos. |
| `permissions.py` | Classes DRF de permissão: verifica tenant, role e status da conta antes de autorizar cada endpoint. |
| `backends.py` | Backend de autenticação customizado (login por email). |

### `transport/` — Módulo Transportadora

| Modelo | Campos-chave |
|---|---|
| `Vehicle` | `plate`, `model`, `year`, `capacity`, `initial_km`, `is_dual_wheel`, `number_of_axles`, `next_review_date/km`. Property `current_km` calculada automaticamente. |
| `Trip` | `vehicle`, `modality` (`per_ton`/`lease`), `tons`, `rate_per_ton`, `days`, `daily_rate`, `status` (`in_progress`/`completed`), `start_date`, `end_date`, `progress_type`, `initial_km`, `final_km`, `fuel_liters`, totais calculados. |
| `TripMovement` | `trip`, `date`, `movement_type` (`expense`/`revenue`), `expense_category` (`fuel`/`other`), `amount`, `description`. Atualiza totais da `Trip` via signal/serializer. |
| `TireInventory` | Pneu físico com código, marca, modelo e condição. |
| `VehicleTirePlacement` | Posicionamento ativo de pneu: `axle`, `side`, `position` (`inside`/`outside` para rodagem dupla). Valida unicidade de pneu em posições ativas. |
| `MaintenanceLog` / `OilChangeLog` | Histórico de manutenções e trocas de óleo. |
| `MaintenanceAlert` | Alerta gerado por data ou km; gerado via `generate_review_alerts` ou task. |

### `finance/` — Módulo Financeiro

| Modelo / Arquivo | Responsabilidade |
|---|---|
| `Transaction` | Transação financeira: `amount`, `type` (receita/despesa), `category`, `payment_method`, `date`, recorrência, parcelamento. |
| `RecurringTransaction` | Regra de recorrência vinculada a `Transaction`. |
| `defaults.py` | Popula formas de pagamento padrão (`Dinheiro`, `PIX`) para novos tenants e na migração retroativa. |
| `signals.py` | Signals Django para eventos de criação/alteração de transações. |
| `assistant_views.py` | Endpoints do assistente de IA; desativado via flag `ASSISTANT_CHAT_ENABLED`. |

### `config/` — Configurações Globais

| Arquivo | Responsabilidade |
|---|---|
| `settings.py` | Configurações Django; leitura de env via `python-decouple`; suporte a `DATABASE_URL` para PostgreSQL. |
| `middleware.py` | Middleware customizado (ex.: bloqueio de acesso por status de conta). |
| `urls.py` | Roteamento global: `/api/auth/`, `/api/users/`, `/api/finance/`, `/api/transport/`, `/api/investments/`, `/api/reports/`. |

---

## Autenticação e Autorização

- **JWT**: access token (curta duração) + refresh token (longa duração), via `djangorestframework-simplejwt`.
- **Fluxo frontend**: login → tokens gravados em `localStorage` → interceptor Axios injeta `Authorization: Bearer` em toda requisição → 401 dispara renovação automática via refresh → falha limpa storage e redireciona para `/login`.
- **must_change_password**: usuário é redirecionado para `/change-password` ao logar até alterar a senha.
- **Rotas protegidas**: `ProtectedRoute` → `ModuleRoute` (feature flag) → `SuperUserRoute` / `PlatformAdminRoute`.
- **Bloqueio por conta**: middleware/permissão backend bloqueia requests de tenants `suspended`/`cancelled`.

---

## Infraestrutura e Deploy

### Produção (`docker-compose.yml`)
- `elofinanceiro-db`: PostgreSQL 16, dados em volume externo.
- `elofinanceiro-backend`: Django + Gunicorn (3 workers, timeout 120s); roda `migrate`, `ensure_platform_superuser` e `collectstatic` na inicialização.
- `elofinanceiro-web`: Nginx; detecta certificado Let's Encrypt e escolhe config HTTPS ou HTTP; serve `dist/` do React e faz proxy `/api` → backend.
- `elofinanceiro-certbot`: renovação automática de certificados a cada 12h.

### Desenvolvimento Local (`docker-compose.local.yml`)
- Mesma stack, porém:
  - Frontend: `http://localhost:8080`
  - PostgreSQL: exposto em `localhost:5432`
  - Volumes Docker nomeados (sem dependência de path externo)

---

## Desenvolvimento Local

### Backend (sem Docker)

```powershell
Set-Location "c:\Engenharia de Software\Planejamento Financeiro\fintech-saas"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

> Se o caminho contiver espaços, use o executável diretamente:
> ```powershell
> & "C:/Engenharia de Software/Planejamento Financeiro/fintech-saas/venv/Scripts/python.exe" manage.py runserver
> ```

### Frontend (sem Docker)

```powershell
Set-Location "c:\Engenharia de Software\Planejamento Financeiro\fintech-web"
npm install
npm run dev
```

### Via Docker Compose (recomendado)

```powershell
# Rebuild completo e subir
docker compose -f docker-compose.local.yml up -d --build

# Apenas rebuild de uma imagem
docker compose -f docker-compose.local.yml build backend

# Logs em tempo real
docker compose -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.local.yml logs -f web

# Rodar migrations após merge
docker compose -f docker-compose.local.yml exec backend python manage.py migrate
```

### Rotina antes de push/deploy

```powershell
# Backend
python manage.py check
python manage.py migrate --plan

# Frontend
npm run build
```

### Smoke tests manuais obrigatórios

1. Login e logout.
2. Self-signup (criação de conta nova).
3. Validar bloqueio de acesso para conta `suspended`/`cancelled`.
4. Criar/editar/encerrar viagem; adicionar movimentação; conferir totais.
5. Cadastrar veículo com eixos e rodagem dupla; registrar pneus; validar bloqueio de duplicidade.
6. Rodar revisão de pneus e conferir posições.
7. Download de relatório PDF (Financeiro e Transportadora).

---

## Variáveis de Ambiente

Os arquivos de ambiente estão em `fintech-saas/`:

| Arquivo | Uso |
|---|---|
| `.env` | Desenvolvimento local sem Docker |
| `.env.docker.local` | Docker Compose local |
| `.env.docker.production` | Produção |
| `.env.docker.release` | Release/homologação |
| `.env.example` e `.env.docker.local.example` | Templates para novos ambientes |

Variáveis principais do backend:

| Variável | Descrição |
|---|---|
| `SECRET_KEY` | Chave secreta Django |
| `DEBUG` | `True` em dev, `False` em produção |
| `DATABASE_URL` | URL completa do PostgreSQL (`postgres://user:pass@host:5432/db`) |
| `ALLOWED_HOSTS` | Lista de hosts permitidos |
| `CORS_ALLOWED_ORIGINS` | Origens CORS permitidas para o frontend |
| `ASSISTANT_CHAT_ENABLED` | `false` desativa o módulo de assistente IA |

Variável do frontend (`.env` ou `vercel.json`):

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API (ex.: `https://elofinanceiro.com.br/api`). Fallback: `/api` |

---

## Convenções e Regras

- **Isolamento de tenant**: toda query de dados deve filtrar por `request.user.tenant`. Nunca expor dados de outro tenant.
- **Formatação numérica no frontend**: entrada do usuário sempre em formato BR (vírgula decimal). Conversão para ponto decimal (`normalizeInputDecimal`) somente no momento do envio à API.
- **Aritmética financeira**: usar `decimal.js` (BigInt) para cálculos de totais, nunca `Number` puro.
- **Permissão de escrita de parâmetros**: restrita a perfis administrativos autorizados do tenant.
- **Histórico de pneus**: removido da tela de veículo; rastreabilidade centralizada na auditoria do módulo `transport`.
- **Assistente IA**: endpoints existem mas retornam `503` quando `ASSISTANT_CHAT_ENABLED=false`. Não remover os endpoints, apenas manter a flag.
