# ZapMax — Funcionalidades do Sistema

## 📊 Dashboard

- Métricas em tempo real: total de conversas, mensagens enviadas/recebidas, agendamentos do dia, contatos ativos.
- Gráficos de evolução diária de mensagens e conversas.
- Exportação de dados do dashboard em CSV.
- Visualização dos próximos agendamentos do dia.

## 💬 Conversas (WhatsApp)

- Chat em tempo real integrado com WhatsApp via Evolution API.
- Envio e recebimento de mensagens de texto.
- Suporte a mídia: imagens, áudios e documentos.
- Indicador de status da mensagem (enviada, entregue, lida).
- Contagem de mensagens não lidas por conversa.
- Filtro por status: abertas, pendentes e encerradas.
- Busca de conversas por nome ou telefone do contato.
- Atribuição de conversa a um operador.
- Badge interativo para alterar a fase do lead (etapa Kanban) diretamente no chat.
- Barra lateral com os próximos 5 agendamentos do contato e ações rápidas (confirmar, cancelar, reagendar).

## 🤖 IA (Inteligência Artificial)

- Assistente de IA integrado ao chat para respostas automáticas.
- Configuração de tom de voz: amigável, profissional ou formal.
- Instruções gerais personalizáveis para o comportamento da IA.
- Saudação e despedida customizáveis.
- Palavras-chave para transferência automática a atendente humano.
- Respostas proibidas configuráveis.
- Tipo de negócio e horário de funcionamento para contexto da IA.
- Suporte a múltiplos modelos OpenAI (GPT-4o, GPT-4o-mini, etc.).
- Modo foco: atendimento, agendamento ou ambos.
- Formatação de estilo de resposta configurável.

## 📚 Base de Conhecimento

- Upload de documentos: PDF, PNG, JPG, TXT, MD e JSON.
- Processamento automático de conteúdo via IA (Gemini) para PDFs e imagens.
- Leitura direta de arquivos de texto (TXT, MD, JSON, CSV, XML, YAML).
- Reprocessamento manual de documentos.
- Conteúdo extraído é utilizado automaticamente pela IA nas respostas.
- Indicador de status: pendente, processando, concluído, erro.

## 📅 Agendamentos

- Agendamento automático via IA com Function Calling (Gemini).
- Fluxo obrigatório: coleta do nome → confirmação → criação.
- Consulta, remarcação e cancelamento via chat.
- Lembretes automáticos personalizáveis (24h antes, 1h antes, etc.).
- Notificações via WhatsApp ao contato quando o operador cancela ou remarca.
- Calendário visual com navegação por mês.
- Filtro por status: pendente, confirmado, cancelado, concluído.
- Horário comercial configurável por dia da semana.
- Intervalo/pausa configurável (ex: horário de almoço).
- Datas bloqueadas (feriados, folgas).
- Serviços cadastráveis com nome, duração e preço.

## 📇 Contatos

- Cadastro manual de contatos com nome, telefone, e-mail e notas.
- Sistema de tags para categorização.
- Importação de contatos a partir de instâncias WhatsApp conectadas.
- Busca e filtro por nome, telefone ou tag.
- Edição e exclusão de contatos.
- Avatar automático com iniciais do nome.

## 📋 Kanban (Gestão de Leads)

- Quadro Kanban com colunas customizáveis (nome, cor, ordem).
- Drag-and-drop de leads entre etapas (desktop e mobile).
- Cards com informações do contato, última mensagem e tempo na etapa.
- Ghost cards com animação durante o arrasto.
- Diálogo para atribuir múltiplas conversas sem etapa.
- Responsivo: colunas empilhadas no mobile com TouchSensor.

## 📱 WhatsApp (Instâncias)

- Conexão de múltiplas instâncias WhatsApp via Evolution API.
- QR Code para pareamento do dispositivo.
- Status da instância: conectado, desconectado, erro, conectando.
- Configurações por instância:
  - Debounce de mensagens (agrupar mensagens rápidas).
  - Simulação de digitação.
  - Divisão de mensagens longas.
  - Memória de contexto (quantidade de mensagens).
  - Palavras para pausar/retomar a IA.
  - Fallback para áudio e imagem.

## ⚙️ Configurações

- Perfil do usuário: nome, telefone, empresa, bio e avatar.
- Preferências: tema (claro/escuro), idioma (PT-BR, EN, ES).
- IA ativada/desativada por padrão em novas conversas.
- Configurações de IA: tom, instruções, saudação, despedida, restrições.
- Chave da API OpenAI e modelo configuráveis.
- Base de conhecimento: upload e gerenciamento de documentos.
- Serviços: cadastro de serviços com preço e duração.
- Horário comercial e datas bloqueadas.
- Lembretes: ativação, mensagem e tempo de antecedência.

## 💰 Planos e Assinaturas

- Página de planos com comparação de funcionalidades.
- Limites por plano: instâncias, usuários, bots, mensagens, armazenamento.
- Período de teste (trial) configurável.
- Status da assinatura: ativa, trial, suspensa, cancelada.
- Link de checkout por plano.

## 🛡️ Administração

- Painel administrativo exclusivo para admins.
- Gestão de usuários: visualizar, editar papel (admin/membro).
- Gestão de planos: criar, editar, ativar/desativar.
- Métricas globais do sistema.
- Configurações do sistema: modo manutenção, cadastro aberto/fechado, trial automático, rate limit, timeout.
- Gestão de instâncias WhatsApp de todos os tenants.
- Configuração da Evolution API (URL e chave global).
- Configuração do botão flutuante de WhatsApp (landing page).
- Gestão do Roadmap público.

## 🗺️ Roadmap

- Página pública de roadmap com funcionalidades planejadas, em andamento e concluídas.
- Sistema de votação para priorização de features.
- Ícones e descrições por item.
- Filtro por status.

## 📖 Como Usar (Documentação)

- Guia passo a passo organizado por seção.
- Seções colapsáveis com instruções detalhadas.
- Links diretos para as páginas de cada funcionalidade.
- Disponível em português, inglês e espanhol.

## 🌐 Internacionalização (i18n)

- Suporte completo a 3 idiomas: Português (BR), Inglês e Espanhol.
- Troca de idioma em tempo real nas configurações.
- Todos os textos da interface traduzidos.

## 🔐 Autenticação e Segurança

- Cadastro com e-mail e senha.
- Login com verificação de e-mail.
- Recuperação de senha.
- Multi-tenancy: cada empresa tem seus dados isolados.
- Row Level Security (RLS) em todas as tabelas.
- Rotas protegidas para usuários autenticados.
- Controle de papéis: admin e membro.

## 🍪 Consentimento de Cookies

- Banner de consentimento de cookies com aceitar/recusar.
- Link para política de privacidade.
- Persistência da escolha via localStorage.

## 📄 Páginas Legais

- Política de Privacidade.
- Termos de Uso.

## 🎨 Interface

- Design responsivo (desktop e mobile).
- Tema claro e escuro.
- Sidebar colapsável com navegação principal.
- Animações com Framer Motion.
- Componentes UI com Shadcn/UI e Radix.
