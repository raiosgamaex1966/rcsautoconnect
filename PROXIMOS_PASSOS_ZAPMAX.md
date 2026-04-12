# Próximos Passos - Correção Conexão Evolution API

Este guia foi criado para que você possa continuar a configuração caso reinicie o computador ou percamos a conexão.

## 1. A Chave Mestra (Global API Key)
Após verificarmos no seu Portainer, a chave que o servidor está usando atualmente é:
**Chave:** `bb18322ba68cc5bd2e9ca46c3f5edcc4`

---

## 2. Comandos para resolver o Erro 401
Se o sistema ainda apresentar "Falha na conexão: HTTP 401", abra o terminal na pasta do projeto e execute estes dois comandos nesta ordem:

### Passo A: Configurar as credenciais no Supabase
```powershell
npx supabase secrets set EVOLUTION_API_URL="https://v2.geradordesitescriativos.com.br" EVOLUTION_API_KEY="bb18322ba68cc5bd2e9ca46c3f5edcc4"
```

### Passo B: Subir as funções atualizadas
```powershell
npx supabase functions deploy admin-data whatsapp-instances send-reminders whatsapp-webhook resend-reminder
```

---

## 3. Como validar se funcionou
1. No ZapMax, vá em **Administração -> Evolution API**.
2. Clique no botão **Verificar Conexão**.
3. O status deve mudar para **Conectado** (Verde).
4. Vá na aba **WhatsApp** e tente criar uma nova instância.

---

## Dica Importante (Problemas ao Colar)
Se o seu computador estiver "modificando" o código ao colar:
1. Copie o comando desejado.
2. No terminal (PowerShell), tente clicar com o **botão direito do mouse** para colar, em vez de usar Ctrl+V.
3. Verifique se o texto colado é exatamente o mesmo que você copiou antes de apertar Enter.
