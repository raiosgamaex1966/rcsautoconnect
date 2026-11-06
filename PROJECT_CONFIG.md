# Configurações do Projeto RCS AutoConnect

> **Atenção**: Documento de referência do projeto e IDs de integração.
> Chaves secretas devem ser consultadas diretamente no painel do Supabase / Vercel.

---

## 1. Supabase (Produção)
- **Nome do Projeto**: `rcsautoconnect`
- **Project ID / Ref**: `pqantnebpappnanvuluu`
- **URL da API**: `https://pqantnebpappnanvuluu.supabase.co`
- **Host do Banco (PostgreSQL)**: `db.pqantnebpappnanvuluu.supabase.co`
- **Porta**: `5432` / `6543` (Pooler)
- **Região**: `sa-east-1` (São Paulo)
- **Organização**: `srwmujdrmfszkpropciq`
- **Chave Anon / Publishable**: Definida em `src/integrations/supabase/client.ts` e nas variáveis de ambiente da Vercel.

---

## 2. Vercel (Frontend)
- **URL de Produção**: `https://rcsautoconnect.vercel.app/`
- **Framework**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Variáveis de Ambiente Necessárias na Vercel**:
  - `VITE_SUPABASE_PROJECT_ID`: `pqantnebpappnanvuluu`
  - `VITE_SUPABASE_URL`: `https://pqantnebpappnanvuluu.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: *(Chave anônima pública do projeto pqantnebpappnanvuluu)*

---

## 3. Evolution API (WhatsApp)
- **URL**: `https://v2.geradordesitescriativos.com.br`
- **Versão**: `2.3.7`
- **Webhook de Entrada**: `https://pqantnebpappnanvuluu.supabase.co/functions/v1/whatsapp-webhook`
