# Changelog - ZapMax

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [01/04/2026] - Versão 1.7.0

### Gerenciamento de Usuários (Admin)

- **Correção de Exclusão de Usuário**: Resolvido o erro `500 (Internal Server Error)` que ocorria ao tentar remover usuários no painel administrativo.
- **Limpeza de Dependências**: Implementação de uma rotina de limpeza agressiva na Edge Function `admin-data`. O sistema agora remove logicamente agendamentos (`schedules`), logs de transferência (`conversation_transfers`), votos do roadmap e preferências do usuário antes da exclusão final, contornando restrições de integridade (`Foreign Key`) mal configuradas no banco de dados.

### Gerenciamento de Instâncias (Admin)

- **Exclusão de Instâncias**: Adicionada funcionalidade de deleção completa de instâncias no painel administrativo. O processo remove a instância do banco de dados e sincroniza a remoção com a Evolution API.
- **Interface Reforçada**: Nova coluna de ações na tabela de instâncias com confirmação de segurança (`AlertDialog`) para evitar exclusões acidentais.
- **Correção de API**: Resolvido o erro 400 na comunicação com a Edge Function `admin-data` através de um parsing de parâmetros mais robusto no backend.

### Automação e Bot de Atendimento

- **Pausa Persistente do Bot**: Implementação de controle de pausa baseado no status da conversa (`pending`). O bot agora mantém o estado de pausa mesmo após novas interações do cliente.
- **Controle via Atendente**: O atendente agora pode interromper o bot diretamente pelo chat do WhatsApp enviando as palavras de comando configuradas (ex: "parar").
- **Retomada Automática**: O bot volta a responder instantaneamente assim que o atendente envia a palavra de ativação (ex: "voltar").
- **Sincronização de Status**: Integração do sistema de pausa com o status de atendimento da conversa na plataforma.

### Internacionalização

- **Traduções Administrativas**: Adicionadas chaves de tradução em Português, Inglês e Espanhol para as novas funções de gerenciamento de instâncias.

---

## [30/03/2026] - Versão 1.5.0

### Controle de Planos e Limites

- **Bloqueio de Conversas**: Implementação de restrição total de acesso às abas de "Conversas" e "Kanban" ao atingir o limite mensal de mensagens do plano.
- **Alertas de Limite**: Novos indicadores visuais e avisos pulsantes na barra lateral para abas bloqueadas por excesso de uso.
- **Reforço de Segurança**: Centralização da lógica de verificação de limites no hook `usePlanLimits` para evitar envios não autorizados.

### Internacionalização

- **Landing Page Dinâmica**: Refatoração completa da seção de planos na home para suportar múltiplos idiomas (PT-BR, EN, ES).
- **Correção de Idioma nos Planos**: Resolvido o problema onde as características dos planos (IA, Agendamento, Suporte) estavam fixas em inglês.
- **Novas Chaves de Tradução**: Implementação de novas chaves nos arquivos de i18n para cobrir todos os detalhes dos planos oferecidos.

---

## [11/03/2026] - Versão 1.4.0

### Adicionado

- **Extração Nativa de PDF**: Implementação da biblioteca `pdf-parse` na Edge Function `process-document`, permitindo a extração de texto local e nativa sem depender da API de Visão da OpenAI para arquivos PDF.
- **Suporte a Novos Formatos**: Adicionado suporte para processamento de arquivos `.md` (Markdown) e `.json` na Base de Conhecimento.
- **Dicas de Formatação**: Nova interface no modal de upload com recomendações de uso de Markdown para melhorar o desempenho da IA.

### Melhorias

- **Tratamento de Erros da OpenAI**: Melhoria na captura e exibição de erros detalhados da API da OpenAI, facilitando o diagnóstico de problemas de cota ou chave de API.
- **Detecção de Tipos de Arquivo**: Refatoração da lógica de decisão de extração baseada na extensão do arquivo para maior precisão e economia de tokens.

### Corrigido

- **Erro 500 no Processamento de PDF**: Resolvido o erro de processamento causado pela tentativa de enviar buffers de PDF codificados em base64 como imagens para a API da OpenAI.

---

## [09/03/2026] - Versão 1.3.0

- **HashRouter & Core Routing**: Substituição do roteamento por hash para compatibilidade universal com servidores `index.html`.
- **URLs de Redirecionamento Supabase**: Atualização dos links de recuperação de senha e confirmação de e-mail para o formato compatível com hash.

## [08/03/2026] - Versão 1.2.0

### Melhorias

- **Experiência de Carregamento Instantâneo**: Implementação de `localStorage` em todos os hooks de busca de dados (`useDashboardMetrics`, `useConversations`, `useMessages`, `useKanban`, `useContacts`, `useWhatsAppInstances`, `useSchedules`, `useAISettings`, `useUserPreferences`, `useUserRole`, `usePlans`, `usePlanLimits`).
- **Padrão Stale-While-Revalidade**: O sistema agora exibe os últimos dados salvos imediatamente ao abrir qualquer página, realizando a atualização silenciosa em segundo plano.
- **Persistência de Admin**: Abas administrativas (Usuários, Roadmap, Métricas, Evolution API, Configurações do Sistema e Botão Flutuante) agora carregam instantaneamente.
- **Remoção de Animações Bloqueantes**: Substituição de componentes `framer-motion` (`motion.div`, `AnimatePresence`) por elementos HTML padrão nas páginas de Dashboard, Admin e Sidebar.
- **Global CSS Performance**: Desativado globalmente `transition-duration` e `animation-duration` para 0s em `index.css`.
- **Renderização de Menus**: A aba "Administração" na sidebar agora aparece no exato momento do carregamento da página, eliminando o delay de verificação de cargo administrativo.
- **Fluxo de Chat**: O histórico de mensagens agora persiste localmente por conversa, permitindo alternar entre chats de forma instantânea.
- **Loading Spinners & Pre-loaders**: Ocultação global de spinners de carregamento (`animate-spin`) e remoção de estados de carregamento bloqueantes (`loading: true`).
- **Transições de Página**: Eliminadas transições de entrada/saída que causavam micro-percepção de lentidão.
- **Tempo de Pintura Inicial (FCP)**: Reduzido para próximo de zero para dados conhecidos.
- **Interatividade**: Páginas como Kanban e Conversas agora são interativas desde o primeiro frame.
- **Percepção do Usuário**: Sensação de "aplicativo nativo" com resposta imediata a todos os cliques.
- **Compatibilidade com Hospedagem**: Migração para `HashRouter` para suporte total em hospedagens compartilhadas (Apache/cPanel) sem necessidade de redirecionamento no servidor.
- **Configuração de Build Progressiva**: Definição de caminhos relativos (`base: "./"`) no Vite para carregamento robusto de assets em qualquer subdiretório.
- **Navegação Suave (Landing Page)**: Implementação de scroll suave para âncoras internas, evitando conflitos com o sistema de hash do roteador.

### Adicionado

- **Camada de Cache Local (Persistence Layer)**: Implementação de `localStorage` em todos os hooks de busca de dados (`useDashboardMetrics`, `useConversations`, `useMessages`, `useKanban`, `useContacts`, `useWhatsAppInstances`, `useSchedules`, `useAISettings`, `useUserPreferences`, `useUserRole`, `usePlans`, `usePlanLimits`).
- **Padrão Stale-While-Revalidade**: O sistema agora exibe os últimos dados salvos imediatamente ao abrir qualquer página, realizando a atualização silenciosa em segundo plano.
- **Persistência de Admin**: Abas administrativas (Usuários, Roadmap, Métricas, Evolution API, Configurações do Sistema e Botão Flutuante) agora carregam instantaneamente.

### Alterado

- **Remoção de Animações Bloqueantes**: Substituição de componentes `framer-motion` (`motion.div`, `AnimatePresence`) por elementos HTML padrão nas páginas de Dashboard, Admin e Sidebar.
- **Global CSS Performance**: Desativado globalmente `transition-duration` e `animation-duration` para 0s em `index.css`.
- **Renderização de Menus**: A aba "Administração" na sidebar agora aparece no exato momento do carregamento da página, eliminando o delay de verificação de cargo administrativo.
- **Fluxo de Chat**: O histórico de mensagens agora persiste localmente por conversa, permitindo alternar entre chats de forma instantânea.

### Removido

- **Loading Spinners & Pre-loaders**: Ocultação global de spinners de carregamento (`animate-spin`) e remoção de estados de carregamento bloqueantes (`loading: true`).
- **Transições de Página**: Eliminadas transições de entrada/saída que causavam micro-percepção de lentidão.

### Resultados de Performance

- **Tempo de Pintura Inicial (FCP)**: Reduzido para próximo de zero para dados conhecidos.
- **Interatividade**: Páginas como Kanban e Conversas agora são interativas desde o primeiro frame.
- **Percepção do Usuário**: Sensação de "aplicativo nativo" com resposta imediata a todos os cliques.

## [07/03/2026] - Versão 1.1.0

### Adicionado

- Inclusão de **2 novos arquivos SQL** na pasta `migrations`.
- Inclusão de **novos arquivos de instruções (.md)** na pasta `guia`.

---

_ZapMax - afCode_
