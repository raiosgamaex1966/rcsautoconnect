# Deploy e Migração — ZapMax

Guia passo a passo para fazer deploy das Edge Functions e migrar o banco de dados para outro projeto Supabase.

---

## Parte 1: Deploy das Edge Functions

### Pré-requisitos

- [Node.js](https://nodejs.org/) instalado (v18+)
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- [Deno](https://deno.land/) instalado (v1.30+)

### 1. Instalar o Supabase CLI

```bash
npx supabase install
npx supabase --version
```

### 2. Fazer login

```bash
npx supabase login
```

Isso abrirá o navegador para autenticação. Após login, o token será salvo localmente.

### 3. Vincular ao projeto de destino

```bash
npx supabase link --project-ref pqantnebpappnanvuluu
```

### 4. Fazer deploy das funções

```bash
npx supabase functions deploy --project-ref pqantnebpappnanvuluu
npx supabase functions deploy --no-verify-jwt

```

### 5. Fazer deploy de todas as migrações

```bash
npx supabase db push --include-all
```

> O `PROJECT_REF` é o ID do seu projeto Supabase. Encontre em: **Dashboard → Settings → General → Reference ID**.

### 6. Configurar os Secrets

Antes do deploy, configure todos os secrets necessários (veja `configuracao-secrets.md`):

```bash
npx supabase secrets set EVOLUTION_API_URL="https://evo.seudominio.com"
npx supabase secrets set EVOLUTION_API_KEY="sua-chave"
```

### 7. Deploy de uma função específica

```bash
npx supabase functions deploy nome-da-funcao
```

### 8. Deploy de todas as funções

```bash
npx supabase functions deploy send-reminders
npx supabase functions deploy whatsapp-instances
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy chat-ai
npx supabase functions deploy process-document
npx supabase functions deploy manage-scheduling
npx supabase functions deploy check-plan-limits
npx supabase functions deploy admin-data
npx supabase functions deploy onboarding
npx supabase functions deploy registration-status
npx supabase functions deploy check-first-admin
npx supabase functions deploy resend-reminder
```

Ou crie um script `deploy-all.sh`:

```bash
#!/bin/bash
FUNCTIONS=(
  "send-reminders"
  "whatsapp-instances"
  "whatsapp-webhook"
  "chat-ai"
  "process-document"
  "manage-scheduling"
  "check-plan-limits"
  "admin-data"
  "onboarding"
  "registration-status"
  "check-first-admin"
  "resend-reminder"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying $fn..."
  npx supabase functions deploy "$fn"
  echo ""
done

echo "✅ Todas as funções foram implantadas!"
```

Torne executável e rode:

```bash
chmod +x deploy-all.sh
./deploy-all.sh
```

### 9. Verificar deploy

```bash
npx supabase functions list
```

### 10. Ver logs de uma função

```bash
npx supabase functions logs nome-da-funcao
```

---

## Parte 2: Migração do Banco de Dados

### Opção A: Usando arquivos de migração (Recomendado)

Se o projeto possui arquivos de migração em `supabase/migrations/`, esta é a forma mais segura.

#### 1. Vincular ao projeto de destino

```bash
npx supabase link --project-ref NOVO_PROJECT_REF
```

#### 2. Aplicar as migrações

```bash
npx supabase db push
```

Isso executará todos os arquivos SQL em `supabase/migrations/` na ordem correta.

#### 3. Verificar

```bash
npx supabase db status
```

---

### Opção B: Exportar e importar via dump (Estrutura + Dados)

#### 1. Exportar do projeto de origem

**Apenas estrutura (schema):**

```bash
pg_dump \
  --host=db.SEU_PROJECT_REF_ORIGEM.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  -f schema.sql
```

**Estrutura + Dados:**

```bash
pg_dump \
  --host=db.SEU_PROJECT_REF_ORIGEM.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  -f full_dump.sql
```

> A senha do banco está em: **Dashboard → Settings → Database → Connection string → Password**.

#### 2. Importar no projeto de destino

```bash
psql \
  --host=db.NOVO_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  -f schema.sql
```

Ou para dump completo:

```bash
psql \
  --host=db.NOVO_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  -f full_dump.sql
```

---

### Opção C: Via Supabase Dashboard (SQL Editor)

Se preferir não usar terminal para o banco:

1. No projeto de **origem**, vá em **SQL Editor**.
2. Exporte a estrutura com:

```sql
-- Copie o resultado deste comando e salve em um arquivo
SELECT pg_catalog.pg_get_tabledef('public', tablename)
FROM pg_tables
WHERE schemaname = 'public';
```

3. No projeto de **destino**, cole e execute os scripts SQL no **SQL Editor**.

> ⚠️ Este método é mais manual e propenso a erros. Prefira as Opções A ou B.

---

## Parte 3: Migrar Storage (Buckets)

### 1. Criar o bucket no destino

No SQL Editor do projeto de destino:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false);
```

### 2. Copiar políticas de storage

Verifique as políticas existentes no projeto de origem e recrie no destino:

```sql
-- Exemplo: política de upload para usuários autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'knowledge-base');
```

### 3. Migrar arquivos

Para migrar os arquivos em si, você precisará baixar do projeto de origem e fazer upload no destino. Isso pode ser feito via:

- **Supabase Dashboard** → Storage → Download/Upload manual
- **Supabase JS Client** → script automatizado de download/upload

---

## Parte 4: Configurar Cron Jobs

Após a migração, configure o cron job para lembretes (veja `configuracao-cron-job.md`):

```sql
-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job
SELECT cron.schedule(
  'send-reminders-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://NOVO_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_NOVA_ANON_KEY"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
```

---

## Checklist de Migração

- [ ] Criar novo projeto no Supabase
- [ ] Vincular via CLI (`supabase link`)
- [ ] Configurar todos os secrets (`supabase secrets set`)
- [ ] Aplicar migrações do banco (`supabase db push`)
- [ ] Fazer deploy de todas as Edge Functions
- [ ] Criar buckets de storage e políticas
- [ ] Migrar arquivos do storage (se necessário)
- [ ] Configurar cron jobs
- [ ] Atualizar variáveis de ambiente no frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
- [ ] Configurar webhook da Evolution API para apontar ao novo projeto
- [ ] Testar todas as funcionalidades
- [ ] Criar primeiro usuário admin

---

## Troubleshooting

| Problema                       | Solução                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `function not found`           | Verifique se o deploy foi feito: `supabase functions list` |
| `permission denied for schema` | Use o usuário `postgres` para migrações                    |
| `relation already exists`      | A tabela já foi criada; ignore ou use `IF NOT EXISTS`      |
| `deno.lock incompatible`       | Delete `deno.lock` e tente novamente                       |
| `secret not found`             | Configure via `supabase secrets set NOME=valor`            |
| Webhook não recebe mensagens   | Atualize a URL do webhook na Evolution API                 |
