# Configuração do Supabase via CLI – Guia em Texto

Neste guia você aprenderá como fazer o **deploy das Edge Functions e das migrations do projeto utilizando a CLI do Supabase via terminal**.

Esse método é uma alternativa ao Deploy Manager e permite realizar todo o processo diretamente pela linha de comando.

---

# 1. Abrindo o Terminal

Primeiro abra um **terminal** dentro da pasta do projeto.

Você pode utilizar:

- Terminal da sua IDE (VS Code, Cursor, etc.)
- PowerShell
- Terminal do sistema operacional

Dentro do projeto existe um arquivo na pasta **guia** chamado:

```
deploy-migration.md
```

Esse arquivo contém todos os comandos necessários para o deploy.

---

# 2. Instalando a CLI do Supabase

Caso você ainda não tenha a **CLI do Supabase instalada**, execute o comando:

```
npx supabase install
```

Esse comando instalará automaticamente a CLI.

Se ocorrer algum erro, pode ser que o Supabase já esteja instalado no seu sistema.

---

# 3. Verificando a Instalação do Supabase

Para verificar se o Supabase já está instalado, execute:

```
supabase --version
```

Se aparecer a versão instalada, significa que a CLI já está disponível no seu sistema.

---

# 4. Fazendo Login no Supabase

Agora precisamos autenticar a CLI com sua conta do Supabase.

Execute o comando de login:

```
supabase login
```

Após executar o comando:

1. Pressione **Enter**
2. O navegador padrão será aberto
3. Um **código de autenticação** será exibido

Copie esse código.

Volte ao terminal e cole o código quando solicitado, depois pressione **Enter**.

Após isso, sua CLI estará autenticada no Supabase.

---

# 5. Obtendo o Project ID

Agora precisamos do **Project ID** do seu projeto.

Dentro do painel do Supabase:

1. Abra seu projeto
2. Vá até:

```
Project Settings
```

3. Copie o **Project ID**

Esse ID será usado no comando de deploy.

---

# 6. Deploy das Edge Functions

Agora vamos fazer o deploy das **Edge Functions** do projeto.

Execute o comando substituindo pelo seu Project ID:

```
supabase functions deploy --project-ref SEU_PROJECT_ID
```

Esse comando fará o deploy de todas as **Edge Functions do projeto ZapMax**.

Aguarde até que o processo seja finalizado.

---

# 7. Desativando a Verificação JWT (Opcional)

Em alguns casos pode ser necessário desativar a verificação JWT das funções.

Execute o comando indicado no arquivo de guia para realizar essa configuração.

Após executar o comando, as funções estarão disponíveis sem a verificação JWT.

---

# 8. Verificando as Migrations

Agora vamos verificar os arquivos de migration existentes.

Execute o comando:

```
supabase migration list
```

Esse comando mostrará todos os arquivos que existem dentro da pasta:

```
supabase/migrations
```

---

# 9. Executando o Deploy das Migrations

Agora vamos aplicar todas as migrations no banco de dados.

Execute o comando:

```
supabase db push
```

Esse comando irá:

- Criar todas as tabelas
- Aplicar todas as migrations
- Configurar a estrutura do banco

Caso apareça uma confirmação no terminal, pressione:

```
Y
```

para continuar com o deploy.

---

# 10. Finalização

Após finalizar esse processo:

- Todas as **Edge Functions estarão deployadas**
- Todas as **migrations estarão aplicadas**
- O banco de dados estará configurado corretamente

Seu projeto Supabase estará completamente configurado.
