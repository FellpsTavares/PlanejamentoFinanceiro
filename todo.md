# TODO / CHANGELOG TÉCNICO — Kaptal Pro

Este documento consolida as alterações realizadas durante esta sessão e as lógicas de negócio necessárias para manutenção do sistema.

## 1) Identidade e escopo atual
- Nome do sistema em uso no código: **FinManager** (alteração para **Kaptal Pro** ainda pendente em telas/componentes).
- Arquitetura: Django + DRF (backend) e React + Vite (frontend).
- Multi-tenant estrito: dados sempre filtrados por `request.user.tenant`.

---

## 2) Alterações concluídas no backend

### 2.1 Governança e permissões
- Inclusão de papel por usuário (`role`): `admin`, `manager`, `operator`.
- Inclusão de admin global de plataforma (`is_platform_admin`).
- Permissões dedicadas:
  - `IsPlatformAdmin` para administração global de tenants.
  - `IsTenantAdminOrManager` para alterar configurações de módulo do tenant.
- CRUD administrativo por tenant (listar/criar/atualizar usuários do tenant no contexto de admin de plataforma).

### 2.2 Configurações por módulo
- Novo modelo `TenantParameter` com chave/valor por `tenant` e `module`.
- Endpoint para tenant atual:
  - `GET /api/tenants/current/parameters/?module=<module>`
  - `PUT /api/tenants/current/parameters/`
- Defaults do módulo de transportadora:
  - `TIPO_RECEBIMENTO_MOTORISTA`: `1` (manual) ou `2` (porcentagem)
  - `PORCENTAGEM_MOTORISTA`
  - `TIPO_PORCENTAGEM`: `bruta` ou `liquida`

### 2.3 Módulo Transportadora — Viagens
- Modelo `Trip` evoluído com campos:
  - `is_received`
  - `base_expense_value` (renomeado na UI para “Outros gastos”)
  - `fuel_expense_value`
  - `initial_km`
  - `final_km`
  - `driver_payment`
  - `expense_value` (total de despesas da viagem)
- Validações adicionadas:
  - valores de despesa não negativos
  - `final_km >= initial_km`
- Cálculo automático no serializer:
  - `total_value` por modalidade (`per_ton` ou `lease`)
  - Se tipo motorista = manual (`1`): usa `driver_payment` informado
  - Se tipo motorista = porcentagem (`2`): calcula conforme parâmetros
    - base bruta: `total_value`
    - base líquida: `max(total_value - (outros_gastos + combustivel), 0)`
  - `expense_value = outros_gastos + combustivel + driver_payment`

### 2.4 Dashboard/resumo transport
- Viagens entram nos agregados:
  - Receita de viagem só quando `is_received = true`
  - Despesa de viagem sempre via `expense_value`

### 2.5 Migrações aplicadas
- `accounts.0005_tenantparameter`
- `transport.0004_trip_base_expense_value_trip_driver_payment`
- `transport.0005_trip_final_km_trip_fuel_expense_value_and_more`

---

## 3) Alterações concluídas no frontend

### 3.1 Rotas e proteção
- Rotas protegidas por autenticação e por módulo (`ModuleRoute`).
- Rota admin de plataforma (`PlatformAdminRoute`).
- Nova página de configurações por módulo.

### 3.2 Configurações por módulo (UI)
- Página para editar parâmetros por módulo habilitado no tenant.
- Escrita permitida visualmente para `admin/manager`.
- Correção de loop de carregamento na página (evita spam de toasts).

### 3.3 Transportadora — viagens
- Formulário de nova viagem e modal de edição com:
  - Outros gastos
  - Gasto de combustível
  - KM inicial/final
  - Recebimento da viagem
  - Pagamento motorista (manual/automático por parâmetros)
- Bloco de previsão com:
  - Total previsto
  - Despesas previstas
  - Líquido previsto (`total - despesas`)

### 3.4 Veículos e perfil do veículo
- Lista de veículos com botões de ação modernizados (`Entrada`, `Saída`, `Viagem`, `Abrir`).
- Botão `Entrada` com fundo verde claro.
- Perfil do veículo exibindo detalhamento da viagem:
  - Outros, Combustível, Motorista
  - KM inicial/final

### 3.5 Sidebar e navegação modular
- Sidebar reorganizada em módulos expansíveis:
  - INICIAL
  - INVESTIMENTOS
  - TRANSPORTADORA
  - CONFIGURAÇÕES
- Ícones de expansão recolhido/expandido (`>` / `˅`).
- Comportamento hamburguer (`☰`) para abrir/fechar sidebar.
- Overlay para fechar ao clicar fora.
- Ajuste para não sobrepor/cortar conteúdo e título.

### 3.6 Investimentos
- Criada página `InvestmentsDashboard` com métricas resumidas.
- Rotas de investimentos protegidas por flag de módulo.

---

## 4) Regras de negócio críticas (documentação de lógica)

1. **Isolamento multi-tenant**
   - Nunca consultar/alterar recursos fora do `tenant` do usuário autenticado.

2. **Permissão de configuração de módulo**
   - Leitura de parâmetros: usuário autenticado do tenant.
   - Escrita de parâmetros: somente `role in [admin, manager]`.

3. **Receita x despesa de viagem**
   - Receita da viagem entra no financeiro apenas se recebida.
   - Despesa da viagem sempre compõe custos operacionais.

4. **Comissão de motorista**
   - Manual: valor informado na viagem.
   - Percentual: depende dos parâmetros do tenant.
   - Base líquida deve considerar dedução de outros gastos + combustível.

5. **Consistência de quilômetros**
   - `final_km` não pode ser menor que `initial_km`.

---

## 5) Pendências sugeridas
- Aplicar rename completo da marca para **Kaptal Pro** em toda UI e textos estáticos.
- Implementar tema de fundos com 3 imagens (geral, investimentos, transportadora) conforme especificação visual.
- Adicionar teste automatizado para cálculo de `TripSerializer` cobrindo:
  - tipo manual
  - tipo percentual bruta
  - tipo percentual líquida
  - km inválido
- Padronizar formatação monetária visual para pt-BR em todos os componentes de viagem/modal.

---

## 6) Comandos úteis de operação
- Backend check: `python manage.py check`
- Migrações: `python manage.py makemigrations && python manage.py migrate`
- Frontend build: `npm run build`

