# TODO / DOCUMENTACAO TECNICA E MANUTENCAO FUTURA

Documento vivo para orientar evolucao do sistema, onboarding tecnico e manutencao preventiva.

## 1) Estado atual do projeto
- Stack: Django + DRF (`fintech-saas`) e React + Vite + Tailwind (`fintech-web`).
- Arquitetura: multi-tenant com isolamento por `request.user.tenant`.
- Foco funcional atual: financeiro, transportadora (viagens + manutencao + pneus + alertas), investimentos, configuracoes por modulo (incluindo Financas), governanca de contas SaaS e relatorios PDF por modulo.

## 2) Funcionalidades consolidadas (referencia rapida)

### 2.1 Configuracoes e governanca
- Aba `Geral` em configuracoes como primeira visao.
- Aba `Financas` em configuracoes com gestao centralizada de categorias e formas de pagamento.
- Gestao de usuarios do tenant (listagem e acoes administrativas conforme perfil).
- CRUD de categorias com suporte a `icon` (emoji).
- Parametros por modulo em `TenantParameter`, incluindo modulo `general`.
- `TenantParameter` aceita modulo `finance`.
- Auditoria de acoes do tenant via `TenantAuditLog` e endpoint dedicado.
- Governanca de contas SaaS por tenant:
  - `account_status` (`active`, `past_due`, `suspended`, `cancelled`)
  - `billing_due_date`
  - `account_notes`
  - bloqueio de acesso quando conta estiver em situacao invalida para uso.
- Gestao de contas exclusiva para superusuario:
  - listagem de contas/tenants com status
  - atualizacao de status e vencimento
  - menu/rota protegidos no frontend.
- Self-signup habilitado para criacao da propria conta (tenant + admin inicial) via tela de login.

### 2.2 Financeiro (melhorias recentes)
- Formas de pagamento padrao por tenant garantidas automaticamente: `Dinheiro` e `PIX`.
- Populacao retroativa de formas de pagamento padrao em tenants ja existentes via migracao.
- Removida criacao inline de forma de pagamento em `Nova Transacao`; gestao ficou centralizada em Configuracoes > Financas.
- Rotulos de navegacao atualizados de `Dashboard` para `Painel` (rotas tecnicas mantidas).
- Assistente operacional (chat) desativado temporariamente por prioridade de negocio:
  - acesso removido do menu/rota no frontend
  - endpoints backend protegidos por flag `ASSISTANT_CHAT_ENABLED=false`.

### 2.3 Transportadora (fluxo operacional)
- `Trip` com ciclo de vida por status (ex.: em curso/encerrada), `start_date`, `end_date` e `progress_type`.
- Lancamentos incrementais em viagem via `TripMovement` (receitas/despesas), com edicao e exclusao.
- Regra de combustivel: descricao opcional e categoria padrao de combustivel.
- Recalculo automatico de totais da viagem com base nas movimentacoes.
- Dashboard/gerenciamento permite abrir viagem especifica por query param (`?trip=<id>`).
- Cadastro de veiculo com suporte a `number_of_axles`, `is_dual_wheel`, `next_review_date`, `next_review_km` e `initial_km`.
- Gestao de pneus por inventario (`TireInventory`) e posicionamento atual por eixo/lado/posicao (`VehicleTirePlacement`).
- Regras de rodagem:
  - rodagem simples: 1 pneu por lado em cada eixo;
  - rodagem dupla: 2 pneus por lado em cada eixo (`inside` e `outside`).
- Validacao para impedir o mesmo pneu em mais de uma posicao simultanea (frontend e backend).
- Rodizio de pneus por troca de posicoes entre origem e destino.
- Controle de manutencao e oleo via `MaintenanceLog` e `OilChangeLog`.
- Alertas de revisao por data/km via `MaintenanceAlert`, com geracao por comando e task.
- Perfil de veiculo reorganizado com secoes expansivas e campos de expansao iniciando recolhidos por padrao.

### 2.4 Home e navegacao
- Home dedicada em `/home` (nao redireciona mais para dashboards).
- Header com botao Home usando logo (`LogoHome.png`).
- Sidebar compacta com expansao em hover.
- Sidebar com identidade visual atualizada (fundo branco e logo oficial em `public/logo/LogoEloFinancas.png`).

### 2.5 Relatorios PDF
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
  - `fintech-saas/accounts/serializers.py`
  - `fintech-saas/accounts/views.py`
  - `fintech-saas/accounts/permissions.py`
  - `fintech-saas/accounts/audit.py`
  - `fintech-saas/config/settings.py`
  - `fintech-saas/finance/views.py`
  - `fintech-saas/finance/defaults.py`
  - `fintech-saas/finance/assistant_views.py`
  - `fintech-saas/transport/models.py`
  - `fintech-saas/transport/serializers.py`
  - `fintech-saas/transport/views.py`
  - `fintech-saas/transport/tasks.py`
  - `fintech-saas/transport/management/commands/generate_review_alerts.py`
  - `fintech-saas/config/urls.py`
- Frontend:
  - `fintech-web/src/App.jsx`
  - `fintech-web/src/pages/ModuleSettings.jsx`
  - `fintech-web/src/pages/Login.jsx`
  - `fintech-web/src/pages/Home.jsx`
  - `fintech-web/src/pages/NewTransaction.jsx`
  - `fintech-web/src/pages/TransportTrips.jsx`
  - `fintech-web/src/pages/TransportDashboard.jsx`
  - `fintech-web/src/pages/TransportVehicleNew.jsx`
  - `fintech-web/src/pages/TransportVehicleProfile.jsx`
  - `fintech-web/src/pages/AccountManagement.jsx`
  - `fintech-web/src/components/Sidebar.jsx`
  - `fintech-web/src/components/AppHeader.jsx`
  - `fintech-web/src/components/SuperUserRoute.jsx`
  - `fintech-web/src/services/reports.js`
  - `fintech-web/src/services/transport.js`
  - `fintech-web/src/services/auth.js`

## 4) Regras de negocio que NAO podem regredir
- Isolamento tenant: qualquer consulta/escrita deve filtrar por tenant do usuario autenticado.
- Permissao de configuracao: escrita de parametros do tenant restrita a perfis administrativos autorizados.
- Viagens:
  - `final_km >= initial_km`.
  - Receita de viagem depende da regra de recebimento/status vigente no fluxo.
  - Totais de viagem devem refletir movimentacoes (`TripMovement`) e nao somente valores manuais.
- Pneus e manutencao:
  - Um mesmo pneu nao pode ocupar duas posicoes ativas no mesmo veiculo.
  - Em rodagem dupla, a posicao (`inside`/`outside`) e obrigatoria para pneus atuais.
  - Trocas de posicao (rodizio) devem preservar historico de montagem/remoção (`mounted_at` / `removed_at`).
  - `current_km` do veiculo deve considerar o maior valor consistente entre viagens concluidas e movimentacao acumulada.
- PDF:
  - Campos solicitados em `fields` precisam ser saneados por whitelist.
  - Ordenacao deve aceitar apenas colunas previstas para cada modulo.

## 5) Migracoes relevantes (historico recente)
- `accounts/0006_tenantauditlog.py`
- `accounts/0008_alter_tenantparameter_module.py`
- `accounts/0009_tenant_account_notes_tenant_account_status_and_more.py`
- `transport/0006_trip_status.py`
- `transport/0007_trip_dates_progress_tripmovement.py`
- `transport/0008_tripmovement_description_optional.py`
- `transport/0009_vehicle_review_tires_maintenance_alerts.py`
- `transport/0010_tire_condition_and_placement_position.py`
- `transport/0011_vehicle_is_dual_wheel.py`
- `finance/0004_default_payment_methods.py`
- `accounts/0010_tenant_review_alert_settings.py`

## 6) Checklist de manutencao futura (priorizado)

### Alta prioridade
- Criar testes automatizados para `Trip` e `TripMovement`:
  - criacao de viagem em curso
  - encerramento de viagem
  - edicao/exclusao de movimentacoes
  - recalc de liquido/receita/despesa
- Criar testes para regras de pneus e rodagem:
  - rodagem simples x rodagem dupla
  - bloqueio de pneu duplicado em posicoes simultaneas
  - rodizio entre posicoes com atualizacao correta de historico
- Criar testes para manutencao e alertas de revisao:
  - gatilho por data limite
  - gatilho por km limite
  - idempotencia da geracao de alertas
- Criar testes de permissao para endpoints de configuracao geral e auditoria.
- Criar testes de contrato para PDF (filtros + `fields` + `order_by/order_dir`).
- Criar testes de bloqueio de conta por tenant (`past_due`, `suspended`, `cancelled`) no login.
- Criar testes para self-signup (`users/register-account/`) com validacoes de slug/email/senha.
- Criar testes de autorizacao de superusuario para gestao de contas (`/admin/accounts`).

### Media prioridade
- Documentar em `README` os fluxos de negocio por modulo (finance, transport, investments).
- Adicionar exemplos de chamadas HTTP para relatorios e configuracoes (colecao Postman ou equivalente).
- Revisar padrao de formatacao monetaria/data no frontend para consistencia.
- Avaliar feature flag de frontend para ocultar funcionalidades por configuracao (ex.: chat/assistente).

### Baixa prioridade
- Revisar naming e branding textual remanescente (uniformizar termos como "Elo Financeiro" em 100% da UI/docs).
- Melhorar acessibilidade dos paineis colapsaveis e navegacao por teclado.
- Revisar naming de assets com espacos/acentos para evitar problemas de URL (padronizar nomes ASCII quando possivel).

## 7) Riscos e pontos de atencao
- Build frontend passa, mas existe aviso do Vite sobre uso misto (import estatico e dinamico) de `src/utils/toast.js`.
- Mudancas de parametros em `TenantParameter` impactam comportamento em tempo real; manter defaults e validacoes sincronizados entre backend e frontend.
- Relatorios PDF dependem de filtros corretos por modulo; qualquer alteracao de schema deve atualizar mapeamentos de campos/ordenacao.
- Se `ASSISTANT_CHAT_ENABLED` permanecer `false`, chamadas diretas para `/api/assistant/*` retornam `503` (comportamento esperado no momento).
- Login foi modernizado com plano de fundo em `public/Plano de fundo Login.png`; alteracoes de arquivo/caminho podem quebrar o visual da tela.
- Regras de pneus dependem de coerencia entre UI (campos por eixo/lado/posicao) e backend (validacao final); qualquer ajuste de layout deve manter o contrato da API.
- Campos expansivos no perfil de veiculo iniciam recolhidos; alteracoes futuras devem evitar regressao de UX e de ordem de hooks no React.

## 8) Rotina recomendada antes de deploy
1. Backend: `python manage.py check`
2. Backend: `python manage.py migrate --plan` e depois `python manage.py migrate`
3. Frontend: `npm run build`
4. Smoke tests manuais:
   - login
  - criar conta (self-signup)
  - validar bloqueio de login para conta inadimplente/suspensa/cancelada
   - criar/editar viagem
   - adicionar/editar/excluir movimentacao
  - cadastrar/editar veiculo com eixos e rodagem dupla
  - registrar pneus atuais e validar bloqueio de duplicidade
  - executar rodizio de pneus e conferir posicoes
  - registrar manutencao/oleo e validar alertas de revisao
   - gerar PDF nos 3 modulos
  - validar tela de configuracoes gerais e aba Financas
  - validar menu/rota de gestao de contas para superusuario

## 9) Comandos uteis
- Backend check: `python manage.py check`
- Aplicar migracoes: `python manage.py migrate`
- Popular base de exemplo: `python manage.py seed_data`
- Frontend dev: `npm run dev`
- Frontend build: `npm run build`
- Nota PowerShell (Windows): usar `& "C:/.../python.exe" manage.py check` para caminhos com espacos.

