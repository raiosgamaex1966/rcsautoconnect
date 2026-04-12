# Subindo o Projeto para uma VPS – Guia em Texto

Neste guia você aprenderá como hospedar o **ZapMax em uma VPS**, configurar o domínio, realizar o deploy da aplicação e criar a primeira conta administradora do sistema.

---

# 1. Preparando a VPS

Primeiro você precisa ter uma **VPS ativa**.

No exemplo do vídeo foi utilizada uma **VPS KVM da Hostinger**, mas você pode utilizar qualquer provedor, como:

- Hostinger
- DigitalOcean
- Contabo
- Vultr
- Hetzner
- AWS

Copie o **IP da sua VPS**, pois ele será utilizado no deploy e na configuração do domínio.

---

# 2. Configurando o Deploy Manager

Abra o **Deploy Manager Pro** e preencha as seguintes informações:

IP da VPS

```
IP_DA_VPS
```

Senha de autenticação da VPS

```
SENHA_DA_VPS
```

Também será necessário informar um **domínio** para acessar a aplicação.

---

# 3. Configurando o Domínio no Cloudflare

Agora será necessário apontar um domínio para a sua VPS.

No exemplo foi utilizado o **Cloudflare**.

Passos:

1. Acesse o painel do Cloudflare
2. Entre no domínio que deseja utilizar
3. Clique em **Add Record**

Configure o registro da seguinte forma:

Tipo

```
A
```

Nome

```
subdominio_ou_dominio
```

IP

```
IP_DA_VPS
```

Depois **desative o Proxy do Cloudflare** (deixe como DNS Only).

Clique em **Save**.

Após isso, o domínio estará apontado para a VPS.

---

# 4. Testando o Apontamento do Domínio

Volte ao **Deploy Manager Pro** e utilize a opção de **teste de domínio** para verificar se o apontamento já foi propagado.

Caso ainda não tenha propagado, aguarde alguns minutos.

---

# 5. Configurando SSL

Agora informe um **e-mail válido**, que será utilizado para gerar automaticamente o **certificado SSL (Let's Encrypt)**.

Esse e-mail será usado apenas para o processo de emissão do certificado.

---

# 6. Definindo o Diretório da Aplicação

No Deploy Manager você também deverá informar o nome da pasta onde o sistema será instalado.

Exemplo:

```
zapmax
```

Esse será o diretório onde os arquivos da aplicação ficarão armazenados na VPS.

---

# 7. Testando a Conexão com a VPS

Antes de iniciar o deploy, clique em:

```
Test Connection
```

Se tudo estiver correto, aparecerá a mensagem:

```
Connection established successfully
```

---

# 8. Selecionando a Pasta do Projeto

Agora selecione a **pasta local do projeto** no seu computador.

Importante:  
Você deve selecionar a **raiz do projeto**, onde estão todos os arquivos da aplicação.

Depois clique em:

```
Selecionar pasta
```

---

# 9. Iniciando o Deploy

Agora clique no botão:

```
Start Deploy
```

O processo irá:

- Enviar os arquivos para a VPS
- Instalar dependências
- Configurar o ambiente
- Gerar o certificado SSL
- Iniciar a aplicação

Esse processo pode levar alguns minutos.

---

# 10. Acessando a Aplicação

Após finalizar o deploy, será exibida a **URL da aplicação**.

Copie a URL e abra no navegador.

Se tudo estiver correto, a aplicação **ZapMax estará funcionando**.

---

# 11. Criando a Primeira Conta

Ao acessar o sistema pela primeira vez, será necessário criar uma conta.

Importante:

⚠️ **A primeira conta criada será automaticamente a conta administradora da plataforma.**

Por isso recomenda-se:

- Criar uma conta exclusiva para administração
- Não utilizar essa conta para uso comum do sistema

Preencha:

- Nome
- E-mail
- Senha

Depois clique em:

```
Criar conta
```

---

# 12. Desativando a Confirmação de E-mail (Opcional)

Por padrão, o Supabase exige **verificação de e-mail**.

Se você quiser desativar essa etapa:

1. Acesse o painel do **Supabase**
2. Vá até:

```
Authentication
```

3. Clique em:

```
Signup Providers
```

4. Desative a opção:

```
Confirm Email
```

Assim os usuários poderão se cadastrar sem precisar confirmar o e-mail.

---

# 13. Personalizando o E-mail de Confirmação (Opcional)

Caso você queira manter a confirmação de e-mail ativa, é possível personalizar o conteúdo enviado.

Dentro do Supabase:

1. Vá até:

```
Authentication
```

2. Clique em:

```
Emails
```

3. Edite o template HTML enviado aos usuários.

Você pode:

- Alterar o layout
- Inserir HTML personalizado
- Modificar textos do e-mail

---

# 14. Corrigindo o Redirecionamento de E-mail

Após confirmar o e-mail, pode ocorrer um redirecionamento para:

```
localhost
```

Para corrigir isso, configure a URL do site no Supabase.

Passos:

1. Acesse o painel do **Supabase**
2. Vá até:

```
URL Configuration
```

3. Adicione a URL do seu site

Exemplo:

```
https://seudominio.com
```

Remova a barra final se houver e clique em **Save**.

Agora, sempre que um usuário confirmar o e-mail, ele será redirecionado corretamente para o site.

---

# 15. Fazendo Login no Sistema

Após confirmar o e-mail ou desativar a verificação, você já poderá acessar o sistema.

Preencha:

- E-mail
- Senha

Clique em:

```
Entrar
```

---

# Conclusão

Após concluir essas etapas:

- O **ZapMax estará hospedado na VPS**
- O **domínio estará configurado**
- O **SSL estará ativo**
- O **sistema estará acessível pela internet**
- A **conta administradora estará criada**

Agora sua aplicação está pronta para uso em produção.
