# TODO / DOCUMENTACAO TECNICA E MANUTENCAO FUTURA

Documento vivo para orientar evolucao do sistema, onboarding tecnico e manutencao preventiva.

## 1) Estado atual do projeto
- Stack: Django + DRF (`fintech-saas`) e React + Vite + Tailwind (`fintech-web`).
- Arquitetura: multi-tenant com isolamento por `request.user.tenant`.
- Foco funcional atual: financeiro, transportadora com viagens em curso, investimentos, configuracoes gerais e relatorios PDF por modulo.

## 2) Funcionalidades consolidadas (referencia rapida)

### 2.1 Configuracoes e governanca
- Aba `Geral` em configuracoes como primeira visao.
- Gestao de usuarios do tenant (listagem e acoes administrativas conforme perfil).
- CRUD de categorias com suporte a `icon` (emoji).
- Parametros por modulo em `TenantParameter`, incluindo modulo `general`.
- Auditoria de acoes do tenant via `TenantAuditLog` e endpoint dedicado.

### 2.2 Transportadora (fluxo operacional)
- `Trip` com ciclo de vida por status (ex.: em curso/encerrada), `start_date`, `end_date` e `progress_type`.
- Lancamentos incrementais em viagem via `TripMovement` (receitas/despesas), com edicao e exclusao.
- Regra de combustivel: descricao opcional e categoria padrao de combustivel.
- Recalculo automatico de totais da viagem com base nas movimentacoes.
- Dashboard/gerenciamento permite abrir viagem especifica por query param (`?trip=<id>`).

### 2.3 Home e navegacao
- Home dedicada em `/home` (nao redireciona mais para dashboards).
- Header com botao Home em icone de casa.
- Sidebar compacta com expansao em hover.

### 2.4 Relatorios PDF
- Endpoints por modulo:
  - `/api/reports/finance-pdf/`
  - `/api/reports/transport-pdf/`
  - `/api/reports/investments-pdf/`
- Filtros suportados por contexto (periodo, veiculo, status, ticker).
- Personalizacao com `fields`, `order_by`, `order_dir`.
- Home com painel de `Relatorios` (selecao de variaveis + ordenacao + download).

## 3) Arquivos-chave para manutencao
- Backend:
  - `fintech-saas/accounts/models.py`
  - `fintech-saas/accounts/views.py`
  - `fintech-saas/accounts/audit.py`
  - `fintech-saas/finance/views.py`
  - `fintech-saas/transport/models.py`
  - `fintech-saas/transport/serializers.py`
  - `fintech-saas/transport/views.py`
  - `fintech-saas/config/urls.py`
- Frontend:
  - `fintech-web/src/pages/ModuleSettings.jsx`
  - `fintech-web/src/pages/Home.jsx`
  - `fintech-web/src/pages/TransportTrips.jsx`
  - `fintech-web/src/pages/TransportDashboard.jsx`
  - `fintech-web/src/components/Sidebar.jsx`
  - `fintech-web/src/components/AppHeader.jsx`
  - `fintech-web/src/services/reports.js`
  - `fintech-web/src/services/transport.js`

## 4) Regras de negocio que NAO podem regredir
- Isolamento tenant: qualquer consulta/escrita deve filtrar por tenant do usuario autenticado.
- Permissao de configuracao: escrita de parametros do tenant restrita a perfis administrativos autorizados.
- Viagens:
  - `final_km >= initial_km`.
  - Receita de viagem depende da regra de recebimento/status vigente no fluxo.
  - Totais de viagem devem refletir movimentacoes (`TripMovement`) e nao somente valores manuais.
- PDF:
  - Campos solicitados em `fields` precisam ser saneados por whitelist.
  - Ordenacao deve aceitar apenas colunas previstas para cada modulo.

## 5) Migracoes relevantes (historico recente)
- `accounts/0006_tenantauditlog.py`
- `transport/0006_trip_status.py`
- `transport/0007_trip_dates_progress_tripmovement.py`
- `transport/0008_tripmovement_description_optional.py`

## 6) Checklist de manutencao futura (priorizado)

### Alta prioridade
- Criar testes automatizados para `Trip` e `TripMovement`:
  - criacao de viagem em curso
  - encerramento de viagem
  - edicao/exclusao de movimentacoes
  - recalc de liquido/receita/despesa
- Criar testes de permissao para endpoints de configuracao geral e auditoria.
- Criar testes de contrato para PDF (filtros + `fields` + `order_by/order_dir`).

### Media prioridade
- Documentar em `README` os fluxos de negocio por modulo (finance, transport, investments).
- Adicionar exemplos de chamadas HTTP para relatorios e configuracoes (colecao Postman ou equivalente).
- Revisar padrao de formatacao monetaria/data no frontend para consistencia.

### Baixa prioridade
- Revisar naming e branding textual (uniformizar nome do produto em toda a UI).
- Melhorar acessibilidade dos paineis colapsaveis e navegacao por teclado.

## 7) Riscos e pontos de atencao
- Build frontend passa, mas existe aviso do Vite sobre uso misto (import estatico e dinamico) de `src/utils/toast.js`.
- Mudancas de parametros em `TenantParameter` impactam comportamento em tempo real; manter defaults e validacoes sincronizados entre backend e frontend.
- Relatorios PDF dependem de filtros corretos por modulo; qualquer alteracao de schema deve atualizar mapeamentos de campos/ordenacao.

## 8) Rotina recomendada antes de deploy
1. Backend: `python manage.py check`
2. Backend: `python manage.py migrate --plan` e depois `python manage.py migrate`
3. Frontend: `npm run build`
4. Smoke tests manuais:
   - login
   - criar/editar viagem
   - adicionar/editar/excluir movimentacao
   - gerar PDF nos 3 modulos
   - validar tela de configuracoes gerais

## 9) Comandos uteis
- Backend check: `python manage.py check`
- Aplicar migracoes: `python manage.py migrate`
- Popular base de exemplo: `python manage.py seed_data`
- Frontend dev: `npm run dev`
- Frontend build: `npm run build`

