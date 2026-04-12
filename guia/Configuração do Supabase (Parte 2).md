# Configuração do Supabase (Parte 2) – Guia em Texto

Neste guia continuaremos a configuração do projeto dentro do **Supabase**.  
Nesta etapa iremos configurar as **chaves secretas utilizadas pelas Edge Functions** e também configurar o **Cron Job responsável pelo envio de lembretes para os clientes**.

---

# 1. Criando Chaves Secretas no Supabase

O sistema precisa de duas chaves secretas relacionadas à **Evolution API**:

- URL da Evolution API
- Chave Global da Evolution API

Essas chaves serão usadas pelas **Edge Functions**.

---

# 2. Acessando a Área de Secrets

Dentro do painel do **Supabase**:

1. Abra seu projeto
2. Vá até a seção:

```
Edge Functions
```

3. Clique em:

```
Secrets
```

Agora iremos criar duas novas chaves.

---

# 3. Criando a Chave da Evolution API URL

Clique em **Add Secret** e crie uma chave com o seguinte nome:

```
EVOLUTION_API_URL
```

No campo **Value**, informe a URL da sua Evolution API.

Exemplo:

```
https://sua-api-evolution.com
```

Depois clique em **Save**.

---

# 4. Criando a Chave da API Global

Agora vamos criar a segunda chave.

Clique novamente em **Add Secret** e utilize o nome:

```
EVOLUTION_API_KEY
```

No campo **Value**, informe a **API Key global da sua Evolution API**.

Depois clique em **Save**.

Após isso, as duas chaves necessárias estarão configuradas.

---

# 5. Configurando o Cron Job

Agora precisamos configurar um **Cron Job**, que será responsável por executar tarefas automáticas do sistema.

Esse serviço será utilizado principalmente para:

- Envio de lembretes
- Processos automáticos do sistema
- Execuções agendadas

---

# 6. Localizando o Script de Configuração

Dentro do projeto existe um arquivo na pasta **guia** chamado:

```
configuracao-cronjob
```

Esse arquivo contém o **script SQL necessário para configurar o Cron Job no Supabase**.

Abra esse arquivo e copie o código SQL.

---

# 7. Ajustando as Variáveis do Script

Antes de executar o script, você precisa substituir duas informações.

Primeiro, a **URL do Supabase**.

Ela já está definida no arquivo `.env`.

Substitua no script:

```
SUPABASE_URL
```

Pela URL do seu projeto.

---

# 8. Inserindo a Chave Pública do Supabase

Agora você precisa substituir a chave pública do Supabase.

No script você encontrará algo semelhante a:

```
SUPABASE_ANON_KEY
```

Copie a chave **anon public key** do Supabase e substitua no script.

Depois de substituir essas duas informações, o script estará pronto para execução.

---

# 9. Executando o Script no SQL Editor

Agora vamos executar o script dentro do Supabase.

Passos:

1. Vá até:

```
SQL Editor
```

2. Cole o script configurado
3. Clique em:

```
Run
```

Após executar, o **Cron Job será criado automaticamente**.

---

# 10. Verificando o Cron Job

Agora vamos confirmar se o job foi criado corretamente.

Dentro do Supabase:

1. Vá até:

```
Integrations
```

2. Clique em:

```
Cron
```

3. Depois acesse:

```
Jobs
```

Você verá o job que acabou de ser criado.

---

# 11. Editando o Cron Job (Opcional)

Se desejar modificar o job, você pode:

- Alterar o **SQL Snippet**
- Alterar o **intervalo de execução**

Isso pode ser feito diretamente na interface do Supabase.

⚠️ Atenção:

Se você configurar um **intervalo muito curto**, o sistema irá consumir mais recursos do Supabase.

---

# Conclusão

Após concluir essas etapas:

- As **chaves da Evolution API estarão configuradas**
- O **Cron Job do sistema estará ativo**
- O projeto estará completamente integrado ao Supabase
