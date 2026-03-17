# Deploy do Backend + PostgreSQL no Railway

Este guia cobre apenas a primeira etapa da implantação: banco PostgreSQL + backend Django no Railway.

Arquitetura desta fase:
- PostgreSQL gerenciado no Railway
- Backend Django/Gunicorn no Railway
- Frontend ainda fora desta etapa

Importante para este projeto:
- O backend usa a pasta [fintech-saas](fintech-saas)
- O health check público é [fintech-saas/config/urls.py](fintech-saas/config/urls.py#L37) em `/healthz/`
- O comando [fintech-saas/accounts/management/commands/ensure_platform_superuser.py](fintech-saas/accounts/management/commands/ensure_platform_superuser.py) só cria o superusuário se `SUPERUSER_ENABLED=true`
- O backend agora aceita variáveis do Railway em formato `DATABASE_URL` e também `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGPORT`

## 1. Pré-requisitos

Antes de começar, confirme:
- o repositório está no GitHub
- a branch de deploy está definida, normalmente `main`
- você já criou ou vai criar o serviço Postgres dentro do mesmo projeto Railway
- o backend está na pasta `fintech-saas`

## 2. Criar ou abrir o projeto no Railway

1. Acesse https://railway.app e faça login.
2. Abra o projeto em que o sistema será implantado.
3. Se o projeto ainda não existir, crie um novo projeto vazio.

Resultado esperado:
- você está dentro de um projeto Railway que terá pelo menos dois serviços: `Postgres` e `backend`

## 3. Criar o banco PostgreSQL no Railway

Se o banco já existe, pule para a etapa 4.

1. Dentro do projeto, clique em `New`.
2. Escolha `Database`.
3. Selecione `PostgreSQL`.
4. Aguarde o serviço ficar disponível.

Resultado esperado:
- aparece um serviço de banco no projeto
- o Railway passa a disponibilizar variáveis como `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` e `PGPASSWORD`

## 4. Adicionar o serviço do backend via GitHub Repo

1. No mesmo projeto, clique em `New`.
2. Escolha `GitHub Repo`.
3. Se for o primeiro uso, clique em `Connect GitHub` e autorize o Railway.
4. Selecione o repositório deste sistema.
5. Aguarde o Railway criar o novo serviço.

Resultado esperado:
- surge um novo serviço do backend vinculado ao repositório

## 5. Definir a pasta correta do backend

1. Abra o serviço recém-criado.
2. Vá em `Settings`.
3. Em `Root Directory`, defina exatamente:

```text
fintech-saas
```

4. Salve.

Por que isso é obrigatório:
- o `manage.py`, o `requirements.txt` e o projeto Django estão dentro dessa pasta
- sem isso o Railway tentará buildar a raiz errada do monorepo

## 6. Manter o método de build

1. Ainda em `Settings`, localize a seção de build.
2. Deixe o serviço usando `Nixpacks`.
3. Confirme a branch de deploy.

Neste projeto, não é necessário usar o Dockerfile do backend para o Railway neste primeiro momento.

## 7. Configurar as variáveis de ambiente do backend

Abra o serviço do backend e vá em `Variables`.

### 7.1 Variáveis obrigatórias do Django

Crie manualmente estas variáveis:

```text
SECRET_KEY=<gere-uma-chave-forte>
APP_ENV=production
DEBUG=False
DB_SSLMODE=require
DB_CONN_MAX_AGE=120
ASSISTANT_ENABLE_GEMINI=false
ASSISTANT_CHAT_ENABLED=false
```

Se quiser criar o superusuário automaticamente no primeiro start, adicione também:

```text
SUPERUSER_ENABLED=true
SUPERUSER_USERNAME=superusuario
SUPERUSER_EMAIL=seu_email_admin@dominio.com
SUPERUSER_PASSWORD=<senha-forte-com-8-ou-mais-caracteres>
SUPERUSER_FORCE_PASSWORD_UPDATE=false
SUPERUSER_TENANT_SLUG=platform
SUPERUSER_TENANT_NAME=Platform Admin
SUPERUSER_TENANT_EMAIL=seu_email_admin@dominio.com
```

Se não quiser criar o superusuário agora, use:

```text
SUPERUSER_ENABLED=false
```

### 7.2 Variáveis de banco vindas do Postgres do Railway

Há duas formas de fazer isso.

Opção recomendada:
- referenciar as variáveis do serviço Postgres dentro do backend usando as referências do próprio Railway

Defina no backend:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
PGHOST=${{Postgres.PGHOST}}
PGPORT=${{Postgres.PGPORT}}
PGDATABASE=${{Postgres.PGDATABASE}}
PGUSER=${{Postgres.PGUSER}}
PGPASSWORD=${{Postgres.PGPASSWORD}}
```

Observação:
- os nomes podem variar ligeiramente na interface do Railway conforme o nome do serviço
- se o serviço do banco tiver outro nome, use esse nome na referência

Alternativa segura, se preferir manter explícito no padrão atual do projeto:

```text
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_SSLMODE=require
```

### 7.3 Variáveis de host, CORS e CSRF

Como você já possui o domínio `elofinanceiro.com.br`, a configuração recomendada é esta:
- frontend na Vercel: `https://elofinanceiro.com.br`
- frontend alternativo: `https://www.elofinanceiro.com.br`
- backend no Railway com domínio próprio: `https://api.elofinanceiro.com.br`

Na primeira subida, antes do domínio próprio estar pronto, você pode usar temporariamente a URL pública do Railway.

Valores temporários, logo após gerar o domínio público do Railway:

```text
ALLOWED_HOSTS=seu-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://seu-backend.up.railway.app
CSRF_TRUSTED_ORIGINS=https://seu-backend.up.railway.app
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

Depois que o domínio `api.elofinanceiro.com.br` estiver configurado no Railway e o frontend for publicado, os valores recomendados para produção ficam assim:

```text
ALLOWED_HOSTS=api.elofinanceiro.com.br,seu-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br,https://api.elofinanceiro.com.br
CSRF_TRUSTED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br,https://api.elofinanceiro.com.br
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

Por que isso é melhor neste cenário:
- `ALLOWED_HOSTS` aceita tanto o domínio final quanto o domínio provisório do Railway
- `CORS_ALLOWED_ORIGINS` libera o frontend principal e o `www`
- `CSRF_TRUSTED_ORIGINS` evita erro 403 em login, admin e requisições com cookie/sessão

## 8. Configurar os comandos de build e start

No serviço do backend, em `Settings` ou `Deploy`, configure:

Build Command:  

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

Start Command:

```bash
python manage.py migrate --noinput && python manage.py ensure_platform_superuser && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120
```

Por que esta sequência faz sentido neste projeto:
- instala dependências Python do backend
- coleta estáticos do Django/WhiteNoise
- aplica migrations automaticamente em cada start
- cria ou atualiza o superusuário apenas se `SUPERUSER_ENABLED=true`
- sobe o Gunicorn escutando a porta injetada pelo Railway

## 9. Fazer o primeiro deploy

1. Abra a aba `Deployments` do serviço backend.
2. Se aparecer um botão como `Apply 33 changes`, clique nele antes de qualquer deploy.
3. Aguarde o Railway aplicar todas as variáveis e settings pendentes.
4. Só depois clique em `Deploy` ou `Redeploy`.
5. Acompanhe os logs.

Importante:
- se você editar `Variables`, `Root Directory`, `Build Command`, `Start Command` ou `Networking`, o Railway pode deixar tudo em modo pendente até você clicar em `Apply changes`
- se tentar fazer deploy antes disso, ele pode usar a configuração antiga e falhar ao buscar a raiz errada do repositório ou iniciar sem as variáveis necessárias

O que observar nos logs:
- instalação de dependências do `requirements.txt`
- execução de `collectstatic`
- execução de `migrate`
- mensagem do comando `ensure_platform_superuser`
- Gunicorn iniciando sem erro de porta

Se o deploy falhar antes do start, normalmente o problema estará em uma destas causas:
- mudanças pendentes não aplicadas no botão `Apply changes`
- `Root Directory` incorreto
- variável obrigatória ausente
- referência incorreta às variáveis do Postgres
- `ALLOWED_HOSTS` ou `CSRF_TRUSTED_ORIGINS` montados com valor inválido

## 10. Gerar o domínio público do backend

1. No serviço backend, abra `Settings`.
2. Vá em `Networking`.
3. Clique em `Generate Domain`.
4. Copie a URL pública gerada.

Exemplo:

```text
https://seu-backend.up.railway.app
```

Agora volte em `Variables` e ajuste os valores temporários, se ainda não fez isso:

```text
ALLOWED_HOSTS=seu-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://seu-backend.up.railway.app
CSRF_TRUSTED_ORIGINS=https://seu-backend.up.railway.app
```

Depois disso, faça um novo redeploy.

## 10.1 Configurar domínio próprio no Railway com Registro.br

Depois que o backend estiver funcionando com o domínio padrão do Railway:

1. No serviço backend do Railway, abra `Settings`.
2. Vá em `Networking`.
3. Adicione um `Custom Domain` com este valor:

```text
api.elofinanceiro.com.br
```

4. O Railway vai informar o registro DNS que deve ser criado no Registro.br.
5. No painel do Registro.br, crie exatamente o registro solicitado pelo Railway.

Na prática, normalmente será um `CNAME` para o subdomínio `api`, apontando para o alvo informado pelo Railway.

Depois da propagação DNS e da validação do certificado SSL, atualize as variáveis do backend para os valores finais de produção:

```text
ALLOWED_HOSTS=api.elofinanceiro.com.br,seu-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br,https://api.elofinanceiro.com.br
CSRF_TRUSTED_ORIGINS=https://elofinanceiro.com.br,https://www.elofinanceiro.com.br,https://api.elofinanceiro.com.br
```

Depois disso, faça um novo redeploy do backend.

## 11. Checklist de validação

Considere esta etapa concluída apenas se todos os itens abaixo estiverem ok:

1. O serviço `Postgres` está ativo no Railway.
2. O serviço backend aparece como `Running`.
3. O deployment mais recente está como `Success`.
4. A URL pública responde em `/healthz/` com:

```json
{"status":"ok"}
```

5. Se `SUPERUSER_ENABLED=true`, o log mostra a criação ou atualização do superusuário.
6. O admin abre em `/admin/`.

## 12. Troubleshooting rápido

### Erro ao clicar em `Deploy the repo`

Se a tela mostrar algo como `Apply 33 changes` e logo depois aparecer `There was an error deploying from source`, a causa mais provável é esta:
- o Railway ainda não aplicou as mudanças de configuração do serviço

Correção recomendada, nesta ordem:
- clique em `Apply changes`
- confirme que o `Root Directory` está como `fintech-saas`
- confirme que `Build Command` e `Start Command` estão preenchidos
- confirme que as variáveis do Postgres e do Django foram salvas
- só então clique em `Deploy`

Se ainda falhar depois disso, abra `Details` no deployment e valide principalmente:
- se o Railway está buildando a pasta `fintech-saas`
- se o erro ocorre no build ou no start
- se existe mensagem de variável ausente, como banco, `SECRET_KEY` ou `SUPERUSER_*`

### Erro de banco logo no boot

Sintoma:
- o backend não sobe e acusa configuração de banco incompleta

Causa provável:
- as variáveis do Postgres não foram vinculadas ao serviço backend

Correção:
- revise `DATABASE_URL` ou os pares `PG*`/`DB_*`
- confirme se o backend e o Postgres estão no mesmo projeto Railway

### Erro 400 ou 403 ao acessar por domínio público

Causa provável:
- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` ou `CSRF_TRUSTED_ORIGINS` ainda não incluem o domínio gerado pelo Railway

Correção:
- atualize essas variáveis e faça redeploy

### O superusuário não foi criado

Causa provável:
- `SUPERUSER_ENABLED=false`
- ou faltou `SUPERUSER_EMAIL`
- ou faltou `SUPERUSER_PASSWORD`

Correção:
- preencha as variáveis obrigatórias e faça redeploy

## 13. Próxima etapa

Depois que backend + banco estiverem estáveis no Railway, a próxima etapa é publicar o frontend na Vercel com:

```text
VITE_API_URL=https://seu-backend.up.railway.app/api
```

O frontend já está preparado para isso em [fintech-web/src/services/api.js](fintech-web/src/services/api.js#L3).