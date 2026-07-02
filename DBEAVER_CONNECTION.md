# Conectar ao PostgreSQL do Railway no DBeaver

## 📋 Pré-requisitos

1. DBeaver instalado
2. Acesso ao projeto Railway
3. Credenciais do banco de dados

## 🔑 Obter as Credenciais do Railway

### Passo 1: Acesse o Railway
1. Entre em https://railway.app
2. Abra o projeto do **Elo Financeiro**
3. Clique no serviço **PostgreSQL**

### Passo 2: Copie as Variáveis
Na aba **Variables** ou **Connect**, você encontrará:

```
PGHOST=crossover.proxy.rlwy.net (ou similar)
PGPORT=39500 (ou outro número)
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=<sua-senha-aqui>
```

Ou pode copiar a **DATABASE_URL** completa:
```
postgresql://postgres:senha@crossover.proxy.rlwy.net:39500/railway
```

## 🔧 Configurar no DBeaver

### Método 1: Nova Conexão (Recomendado)

1. Abra o DBeaver
2. Clique em **Database** → **New Database Connection**
3. Selecione **PostgreSQL** e clique em **Next**

4. Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Host** | `crossover.proxy.rlwy.net` (ou o host do seu Railway) |
| **Port** | `39500` (ou a porta do seu Railway) |
| **Database** | `railway` |
| **Username** | `postgres` |
| **Password** | Cole a senha do Railway |

5. **IMPORTANTE:** Clique na aba **SSL**
   - Marque: **Use SSL**
   - SSL Mode: Selecione **require** ou **prefer**
   - SSL Factory: `org.postgresql.ssl.NonValidatingFactory`

6. Clique em **Test Connection**
   - Se aparecer um popup para baixar drivers, clique em **Download**
   - Aguarde o download completar
   - Teste novamente

7. Se conectar com sucesso, clique em **Finish**

### Método 2: Via DATABASE_URL

1. Abra o DBeaver
2. Clique em **Database** → **New Database Connection**
3. Selecione **PostgreSQL** e clique em **Next**
4. Na barra de ferramentas da janela de conexão, clique no botão **URL**
5. Cole a DATABASE_URL completa:
   ```
   postgresql://postgres:senha@crossover.proxy.rlwy.net:39500/railway?sslmode=require
   ```
6. Clique em **Test Connection**
7. Se funcionar, clique em **Finish**

## ✅ Verificar Conexão

Após conectar, você deve ver:

```
railway
  ├── Schemas
  │   └── public
  │       ├── Tables
  │       │   ├── accounts_tenant
  │       │   ├── accounts_user
  │       │   ├── transport_trip
  │       │   ├── transport_tripmovement
  │       │   ├── transport_vehicle
  │       │   └── ... (outras tabelas)
  │       └── ...
  └── ...
```

## 🔍 Consultas Úteis

### Ver todas as viagens
```sql
SELECT 
    id, 
    date, 
    status, 
    total_value, 
    expense_value,
    is_received
FROM transport_trip
ORDER BY id DESC
LIMIT 20;
```

### Ver movimentações de uma viagem
```sql
SELECT 
    id,
    date,
    movement_type,
    expense_category,
    amount,
    description,
    is_auto_generated
FROM transport_tripmovement
WHERE trip_id = 82
ORDER BY id;
```

### Contar movimentações automáticas vs manuais
```sql
SELECT 
    is_auto_generated,
    COUNT(*) as total
FROM transport_tripmovement
GROUP BY is_auto_generated;
```

## ⚠️ Cuidados Importantes

### ✅ PODE fazer:
- Consultas SELECT (leitura)
- Análise de dados
- Gerar relatórios
- Verificar estrutura do banco

### ❌ NÃO FAÇA em produção:
- DELETE sem WHERE (nunca!)
- UPDATE em massa sem conferir
- DROP TABLE
- TRUNCATE
- Alterações na estrutura (CREATE, ALTER, DROP)

### 🛡️ Boas Práticas:
1. **Sempre use transações para testes:**
   ```sql
   BEGIN;
   -- suas queries aqui
   ROLLBACK; -- desfaz tudo
   -- ou COMMIT; -- confirma
   ```

2. **Teste antes de deletar:**
   ```sql
   -- Primeiro veja o que vai deletar
   SELECT * FROM transport_tripmovement WHERE id = 243;
   
   -- Só depois delete
   DELETE FROM transport_tripmovement WHERE id = 243;
   ```

3. **Faça backup antes de operações críticas:**
   - Clique direito na tabela → **Export Data**
   - Salve em CSV ou SQL

## 🔒 Segurança

- **Nunca compartilhe as credenciais** do banco de produção
- **Use conexão SSL** sempre (sslmode=require)
- **Não exponha a senha** em commits ou prints
- **Rotacione a senha** periodicamente no Railway

## 🆘 Problemas Comuns

### Erro: "Connection refused"
- Verifique se o host e porta estão corretos
- O Railway pode ter mudado o proxy, verifique no dashboard

### Erro: "SSL required"
- Configure SSL mode como "require" nas configurações de conexão
- Use `?sslmode=require` na URL

### Erro: "Authentication failed"
- Verifique se a senha está correta (sem espaços extras)
- A senha pode ter caracteres especiais, copie diretamente do Railway

### Erro: "Database does not exist"
- Confirme que o database name é exatamente `railway`
- Verifique no Railway se o nome está diferente

## 📊 Monitoramento

No DBeaver, você pode:
1. Ver tamanho das tabelas
2. Analisar índices
3. Visualizar relações (ER Diagram)
4. Exportar dados
5. Executar queries complexas

**Agora você está pronto para conectar no banco de produção!** 🎉
