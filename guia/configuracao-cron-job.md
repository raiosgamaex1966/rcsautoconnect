# Configuração do Cron Job — ZapMax

Este guia explica como configurar o cron job utilizado pelo ZapMax para envio automático de lembretes de agendamento via WhatsApp.

---

## Pré-requisitos

1. Projeto Supabase com as Edge Functions implantadas.
2. Extensões `pg_cron` e `pg_net` habilitadas no banco de dados.

### Habilitar Extensões

Execute no **SQL Editor** do Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

> ⚠️ Essas extensões só podem ser habilitadas pelo owner do banco (geralmente já disponíveis em projetos Supabase).

---

## Cron Job: Envio de Lembretes

A Edge Function `send-reminders` verifica a cada minuto se há agendamentos próximos que precisam de lembrete e envia via WhatsApp.

### Criar o Cron Job

Substitua os valores abaixo pelos do seu projeto:

- `SEU_PROJECT_REF` → o ID do seu projeto Supabase (ex: `abcdefghijklmnop`)
- `SUA_ANON_KEY` → a chave anon/pública do seu projeto

```sql
SELECT cron.schedule(
  'send-reminders-every-5-min',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pqantnebpappnanvuluu.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYW50bmVicGFwcG5hbnZ1bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTA0NDcsImV4cCI6MjA5MDcyNjQ0N30.mZR4NL0r6EYmxEeeqFyad2Um9BsLxcuhTtczLg12lw0"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
```

### Frequência

| Expressão Cron | Descrição         |
| -------------- | ----------------- |
| `* * * * *`    | A cada 1 minuto   |
| `*/5 * * * *`  | A cada 5 minutos  |
| `*/10 * * * *` | A cada 10 minutos |
| `0 * * * *`    | A cada hora       |

A configuração padrão recomendada é **a cada 5 minutos** (`*/5 * * * *`), que oferece um bom equilíbrio entre pontualidade e uso de recursos.

---

## Verificar Cron Jobs Ativos

```sql
SELECT * FROM cron.job ORDER BY jobid;
```

## Remover um Cron Job

```sql
SELECT cron.unschedule('send-reminders-every-5-min');
```

---

## Como Funciona

1. O cron dispara a Edge Function `send-reminders` via HTTP POST.
2. A função busca todos os lembretes ativos (`reminders` com `enabled = true`).
3. Para cada lembrete, calcula o horário alvo usando `offset_minutes`.
4. Busca agendamentos com status `pending` ou `confirmed` dentro da janela de tempo.
5. Verifica se o lembrete já foi enviado (tabela `reminder_logs`).
6. Envia a mensagem via Evolution API para o WhatsApp do contato.
7. Registra o envio na tabela `reminder_logs` para evitar duplicatas.
8. Salva a mensagem na conversa do contato.

### Variáveis de Template

Na mensagem do lembrete, você pode usar:

| Variável    | Substituída por            |
| ----------- | -------------------------- |
| `{nome}`    | Nome do contato            |
| `{servico}` | Título do agendamento      |
| `{dia}`     | Data no formato DD/MM/AAAA |
| `{hora}`    | Horário no formato HH:MM   |
| `{data}`    | Data no formato DD/MM/AAAA |

### Exemplo de Mensagem

```
Olá {nome}! 👋 Lembrando do seu agendamento de {servico} amanhã, dia {dia} às {hora}. Nos vemos lá!
```

---

## Secrets Necessários

Certifique-se de que os seguintes secrets estão configurados no Supabase:

| Secret                      | Descrição                              |
| --------------------------- | -------------------------------------- |
| `SUPABASE_URL`              | URL do projeto Supabase                |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (acesso admin)        |
| `EVOLUTION_API_URL`         | URL da Evolution API                   |
| `EVOLUTION_API_KEY`         | Chave de autenticação da Evolution API |

---

## Troubleshooting

### Lembretes não estão sendo enviados?

1. Verifique se o cron job está ativo: `SELECT * FROM cron.job;`
2. Verifique os logs da Edge Function no dashboard do Supabase.
3. Confirme que existe pelo menos uma instância WhatsApp com status `connected`.
4. Verifique se o contato do agendamento tem número de telefone cadastrado.
5. Confirme que o lembrete tem `enabled = true` e `message` preenchida.
6. Verifique na tabela `reminder_logs` se o lembrete já foi registrado como enviado.
