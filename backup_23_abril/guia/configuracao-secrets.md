# Configuração de Secrets — ZapMax

Este guia explica como configurar os secrets (variáveis de ambiente seguras) necessários para o funcionamento do ZapMax em um projeto Supabase.

---

## O que são Secrets?

Secrets são variáveis de ambiente criptografadas armazenadas no Supabase. Elas ficam disponíveis apenas nas Edge Functions e **nunca são expostas ao frontend**. Isso garante que chaves de API e credenciais sensíveis permaneçam protegidas.

---

## Secrets Necessários

| Secret                      | Obrigatório | Descrição                                                    | Onde obter                                                                      |
| --------------------------- | ----------- | ------------------------------------------------------------ | 
| `EVOLUTION_API_URL`         | ✅ Sim      | URL base da sua instância Evolution API                      | Servidor onde a Evolution API está hospedada (ex: `https://evo.seudominio.com`) |
| `EVOLUTION_API_KEY`         | ✅ Sim      | Chave de autenticação da Evolution API                       | Definida na configuração da Evolution API (variável `AUTHENTICATION_API_KEY`)   |

---

## Como Configurar

### Via Supabase CLI (Recomendado)

1. Instale o Supabase CLI:

```bash
npm install -g supabase
```

2. Faça login:

```bash
supabase login
```

3. Vincule ao seu projeto:

```bash
supabase link --project-ref SEU_PROJECT_REF
```

4. Defina cada secret:

```bash
supabase secrets set EVOLUTION_API_URL="https://evo.seudominio.com"
supabase secrets set EVOLUTION_API_KEY="sua-chave-evolution"
```

5. Verifique os secrets configurados:

```bash
supabase secrets list
```

### Via Supabase Dashboard

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard).
2. Selecione seu projeto.
3. Vá em **Settings → Edge Functions**.
4. Na seção **Secrets**, clique em **Add new secret**.
5. Insira o **nome** e o **valor** do secret.
6. Clique em **Save**.

Repita para cada secret listado acima.

---

## Boas Práticas de Segurança

### ✅ Faça

- Use `SUPABASE_SERVICE_ROLE_KEY` **apenas** em Edge Functions (servidor).
- Rotacione as chaves periodicamente.
- Use chaves diferentes para ambientes de desenvolvimento e produção.
- Mantenha a Evolution API em um servidor seguro com HTTPS.

### ❌ Não Faça

- **Nunca** coloque `SERVICE_ROLE_KEY` no código frontend.
- **Nunca** comite secrets em repositórios Git.
- **Nunca** compartilhe chaves em canais públicos.
- **Nunca** use a `SERVICE_ROLE_KEY` em chamadas do navegador.
- **Nunca** armazene secrets em arquivos `.env` commitados.

---

## Verificação

Após configurar todos os secrets, verifique se as Edge Functions estão funcionando:

### Testar a função de lembretes

```bash
curl -X POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/send-reminders' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SUA_ANON_KEY' \
  -d '{"time": "2025-01-01T00:00:00Z"}'
```

A resposta esperada:

```json
{
  "success": true,
  "data": { "sent": 0, "errors": 0, "error_details": [] }
}
```

### Testar a função de instâncias WhatsApp

```bash
curl -X POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-instances' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN' \
  -d '{"action": "list"}'
```

---

## Troubleshooting

| Erro                        | Causa Provável                            | Solução                                              |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `EVOLUTION_API_URL not set` | Secret não configurado                    | Configure via CLI ou Dashboard                       |
| `401 Unauthorized`          | Chave inválida ou expirada                | Verifique e atualize o secret                        |
| `Function not found`        | Edge Function não implantada              | Faça deploy: `supabase functions deploy nome-funcao` |
| `Network error`             | URL da Evolution API incorreta ou offline | Verifique a URL e o status do servidor               |

---

## Edge Functions do Projeto

| Função                | Descrição                                                 |
| --------------------- | --------------------------------------------------------- |
| `send-reminders`      | Envia lembretes automáticos de agendamento via WhatsApp   |
| `whatsapp-instances`  | Gerencia instâncias WhatsApp (criar, conectar, deletar)   |
| `whatsapp-webhook`    | Recebe mensagens do WhatsApp via webhook                  |
| `chat-ai`             | Processa mensagens com IA (OpenAI) e base de conhecimento |
| `process-document`    | Extrai conteúdo de documentos da base de conhecimento     |
| `manage-scheduling`   | Gerencia agendamentos via IA com Function Calling         |
| `check-plan-limits`   | Verifica limites do plano do tenant                       |
| `admin-data`          | Fornece dados administrativos para o painel admin         |
| `onboarding`          | Cria tenant e perfil no primeiro acesso                   |
| `registration-status` | Verifica se o cadastro está aberto                        |
| `check-first-admin`   | Verifica se é o primeiro admin do sistema                 |
| `resend-reminder`     | Reenvia um lembrete específico manualmente                |

---

## Resumo Rápido

```bash
# 1. Login
supabase login

# 2. Vincular projeto
supabase link --project-ref SEU_PROJECT_REF

# 3. Configurar todos os secrets
supabase secrets set EVOLUTION_API_URL="https://evo.seudominio.com"
supabase secrets set EVOLUTION_API_KEY="sua-chave"

# 4. Verificar
supabase secrets list

# 5. Deploy das funções
supabase functions deploy send-reminders
supabase functions deploy whatsapp-instances
supabase functions deploy whatsapp-webhook
supabase functions deploy chat-ai
supabase functions deploy process-document
supabase functions deploy manage-scheduling
supabase functions deploy check-plan-limits
supabase functions deploy admin-data
supabase functions deploy onboarding
supabase functions deploy registration-status
supabase functions deploy check-first-admin
supabase functions deploy resend-reminder
```
