# Corrigindo Acesso de Admin no Sistema (Guia Passo a Passo)

Este guia explica como corrigir erros de acesso administrativo após realizar o login no sistema. Esses erros normalmente aparecem no console do navegador e precisam ser corrigidos diretamente no Supabase, executando alguns comandos SQL.

---

# 1. Problema Inicial

Após realizar o login no sistema, é possível que vários erros apareçam no console do navegador.

Esses erros geralmente ocorrem porque:

- O usuário ainda não possui tenant associado

- O usuário não possui plano atribuído

- O admin não foi configurado corretamente

Para corrigir isso, será necessário executar alguns scripts SQL no Supabase.

---

# 2. Acessando os Scripts SQL

Dentro do projeto existe uma pasta chamada: guia > Sql

Nessa pasta está o arquivo responsáveis por corrigir os problemas de configuração. "fix_missing_tenants.sql"

Abra o arquivo correspondente e copie o **código SQL da etapa indicada no vídeo tutorial**.

---

# 3. Executando SQL no Supabase

1. Acesse o **painel do Supabase**
2. Abra o seu projeto
3. Vá até: SQL Editor

4. Cole o código SQL copiado

5. Clique no botão: Run

Isso executará o script e aplicará a correção na base de dados.

---

# 4. Corrigindo Associação de Tenant

Execute o segundo script SQL disponível na pasta Sql.

Esse script corrige a associação do tenant com o usuário.

Passos:

1. Copie o script

2. Cole no SQL Editor

3. Clique em Run

Após executar, o sistema deverá mostrar uma confirmação indicando que o tenant foi corrigido corretamente para o usuário.

---

# 5. Garantindo Plano Free para Novos Usuários

Agora execute o último script SQL.

Esse script garante que todo novo usuário criado no sistema receba automaticamente o plano Free.

Passos:

1. Copie o código do script

2. Cole no SQL Editor

3. Clique em Run

Isso garante que todos os usuários novos tenham um plano associado automaticamente.

---

# 6. Atualizando o Painel

Após executar os scripts:

1. Volte para o painel do sistema

2. Recarregue a página

Agora deverá aparecer a aba: Administração

Clique nessa aba.

Seu usuário **Admin** deverá aparecer com um **plano ativo**.

---

# 7. Gerenciando Planos

Dentro da aba **Planos**, você poderá:

- Renomear planos existentes
- Criar novos planos
- Definir planos para usuários

⚠️ Importante:

O sistema precisa ter **pelo menos um plano criado e associado ao usuário admin**, caso contrário vários erros aparecerão no console.

---

# 8. Quando Executar Esses Scripts

Esses scripts devem ser executados **logo após:**

- Fazer o deploy do sistema
- Executar as migrations do banco
- Configurar o Supabase

Eles corrigem a configuração inicial do sistema.

---

# 9. Script de Diagnóstico (Opcional)

Existe também um **script de diagnóstico** disponível na pasta SQL.

Ele serve para verificar se o usuário possui permissão de **admin**.

Ao executar esse script, o sistema deve listar seu usuário com: user_role = admin

Se seu usuário não aparecer:

Isso significa que as Edge Functions não foram deployadas corretamente.

---

# 10. Como Funciona a Criação do Admin

Quando o sistema está configurado corretamente:

- O primeiro usuário cadastrado automaticamente recebe permissões de Admin

Se isso não aconteceu, verifique:

- Deploy das Edge Functions

- Execução das migrations

- Execução dos scripts SQL

---

# 11. Finalização

Após executar todos os scripts:

- O Supabase estará configurado corretamente

- O usuário admin terá acesso ao painel

- O sistema estará funcional

---

Pronto. A configuração do Supabase e do acesso Admin foi concluída com sucesso.
