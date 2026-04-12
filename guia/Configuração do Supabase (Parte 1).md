# Configuração do Supabase (Parte 1) – Guia em Texto

Neste guia você aprenderá como configurar o **Supabase** para utilizar o sistema **ZapMax**. 
O processo envolve baixar o código fonte, configurar o ambiente local, criar um projeto no Supabase e realizar o deploy das migrations e Edge Functions.

---

# 1. Baixando e Abrindo o Projeto

Após adquirir o sistema, você receberá acesso ao **código fonte do projeto**.

Passos:

1. Baixe o código fonte para o seu computador
2. Extraia o arquivo em uma pasta
3. Abra o projeto em uma IDE de sua preferência

Você pode utilizar qualquer IDE, por exemplo:

- VS Code
- Cursor
- Antigravity
- Ou qualquer outra IDE que você esteja familiarizado

---

# 2. Instalando as Dependências do Projeto

Se você deseja rodar o projeto **localmente para testes ou personalizações**, será necessário instalar as dependências.

Abra o terminal dentro da IDE e execute:

```
npm install
```

Esse comando irá baixar todas as dependências necessárias para rodar o projeto.

Após finalizar a instalação, execute:

```
npm run dev
```

Isso iniciará o projeto localmente em seu computador, permitindo que você:

- Faça testes
- Realize personalizações
- Edite funcionalidades do sistema

---

# 3. Criando um Projeto no Supabase

O sistema utiliza o **Supabase como banco de dados**.

Portanto, você precisa criar uma conta em:

https://supabase.com

Após criar sua conta:

1. Acesse o painel do Supabase
2. Crie um **novo workspace**
3. Clique em **New Project**

No plano gratuito é possível criar até **2 projetos**.

---

# 4. Criando o Projeto ZapMax

Durante a criação do projeto você deverá preencher:

Nome do projeto  
Exemplo:

```
zapmax
```

Defina também:

- Senha do banco de dados
- Região do servidor

Recomendado:

```
South America (São Paulo)
```

Depois clique em:

```
Create New Project
```

Aguarde até que o projeto seja criado.

---

# 5. Arquivos que Precisam ser Configurados

Após criar o projeto no Supabase, será necessário configurar dois arquivos no projeto local.

Arquivo 1:

```
.env
```

Esse arquivo está na **raiz do projeto**.

Arquivo 2:

```
config.toml
```

Esse arquivo está dentro da pasta:

```
/supabase
```

---

# 6. Obtendo o Project ID no Supabase

Agora precisamos pegar algumas informações dentro do Supabase.

Passos:

1. Abra o projeto no Supabase
2. Vá até **Project Settings**
3. Copie o **Project ID**

Depois substitua o valor nos seguintes locais:

No arquivo `.env`

```
SUPABASE_URL
```

E no arquivo:

```
supabase/config.toml
```

No campo:

```
project_id
```

---

# 7. Obtendo a Chave Public (Anon Key)

Agora precisamos da **chave pública do Supabase**.

Passos:

1. Vá até **API Settings** dentro do Supabase
2. Localize a chave:

```
anon public (legacy)
```

3. Copie essa chave

Depois substitua no arquivo `.env`.

Salve o arquivo após inserir a chave.

---

# 8. Deploy das Migrations e Edge Functions

Após configurar os arquivos, o próximo passo é realizar o **deploy das migrations e das Edge Functions**.

Caso você esteja utilizando o **Deploy Manager Pro**, será necessário gerar um **Access Token** no Supabase.

---

# 9. Gerando Access Token no Supabase

Passos:

1. Vá até **Account Preferences**
2. Clique em **Access Tokens**
3. Clique em:

```
Generate New Token
```

Defina:

- Nome do token
- Tempo de expiração

Depois copie o token gerado.

---

# 10. Configurando o Deploy Manager

Agora dentro do **Deploy Manager Pro** você deverá informar:

Access Token

```
SEU_ACCESS_TOKEN
```

Project ID

```
SEU_PROJECT_ID
```

Depois clique em **Test Connection** para verificar se a conexão foi realizada corretamente.

---

# 11. Selecionando os Diretórios do Projeto

Agora será necessário informar os diretórios do projeto.

Selecione a pasta:

```
/supabase
```

Dentro dela certifique-se que estão configurados:

```
/migrations
/functions
config.toml
```

---

# 12. Executando o Deploy

Após confirmar que tudo está configurado corretamente:

1. Clique em **Start Deploy**
2. Aguarde o processo finalizar

O sistema irá automaticamente:

- Executar todas as migrations
- Criar as tabelas
- Fazer deploy das Edge Functions

Tudo isso sem necessidade de rodar comandos manualmente.

---

# 13. Verificando as Tabelas no Supabase

Após o deploy finalizar:

1. Volte ao painel do Supabase
2. Clique em:

```
Table Editor
```

Você verá todas as **tabelas do sistema já criadas**.

---

# 14. Verificando as Edge Functions

Agora vá até:

```
Edge Functions
```

Você verá todas as **funções do sistema já publicadas no Supabase**.

Isso confirma que o deploy foi realizado corretamente.

---

# Conclusão

Após finalizar essas etapas:

- O banco de dados estará configurado
- As tabelas do sistema estarão criadas
- As Edge Functions estarão ativas
- O projeto estará pronto para uso

No próximo passo será continuado o processo de configuração do sistema.
