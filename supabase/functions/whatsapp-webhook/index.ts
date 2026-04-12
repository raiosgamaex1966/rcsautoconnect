import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateAIResponse(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  conversationId: string,
  instanceEvolutionId: string | null,
  contactPhone: string,
  instanceId: string,
  incomingMediaType: string | null,
) {
  try {
    // Check if AI is enabled
    const { data: aiSettings } = await supabaseAdmin
      .from("ai_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!aiSettings || aiSettings.ai_enabled === false) {
      console.log("AI disabled for tenant", tenantId);
      return;
    }

    const openaiApiKey = aiSettings.openai_api_key;
    const openaiModel = aiSettings.openai_model || "gpt-4o-mini";

    if (!openaiApiKey) {
      console.error("OpenAI API Key not configured for tenant", tenantId, "skipping auto-response");
      return;
    }

    // Get current conversation status
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("status")
      .eq("id", conversationId)
      .maybeSingle();

    // Load instance settings
    const { data: instSettings } = await supabaseAdmin
      .from("instance_settings")
      .select("*")
      .eq("instance_id", instanceId)
      .maybeSingle();

    // --- Pause control (Status-based) ---
    if (instSettings) {
      const pauseWords = (instSettings.pause_words || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
      const resumeWords = (instSettings.resume_words || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);

      // Get last inbound message content directly from function call (or db fallback if needed)
      const { data: lastMsg } = await supabaseAdmin
        .from("messages")
        .select("content")
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();
      
      const lastContent = (lastMsg?.content || "").toLowerCase().trim();

      if (pauseWords.includes(lastContent)) {
        console.log(`Bot PAUSE command detected. Setting conversation ${conversationId} to pending.`);
        await supabaseAdmin.from("conversations").update({ status: "pending" }).eq("id", conversationId);
        return;
      }

      if (resumeWords.includes(lastContent)) {
        console.log(`Bot RESUME command detected. Setting conversation ${conversationId} to open.`);
        await supabaseAdmin.from("conversations").update({ status: "open" }).eq("id", conversationId);
        // Continue to generate response if needed, or return after re-enabling
      }
    }

    // If conversation is pending, it means it's paused for the bot
    if (conversation?.status === "pending") {
      console.log(`Bot is paused for conversation ${conversationId} (status is pending). Skipping.`);
      return;
    }

    // --- Debounce: wait and check for newer messages ---
    if (instSettings?.debounce_enabled && instSettings.debounce_seconds > 0) {
      const waitMs = instSettings.debounce_seconds * 1000;
      console.log(`Debounce: waiting ${instSettings.debounce_seconds}s for conversation ${conversationId}`);

      // Get the latest inbound message ID before sleeping
      const { data: preMsg } = await supabaseAdmin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();

      const preMsgId = preMsg?.id;

      await new Promise((resolve) => setTimeout(resolve, waitMs));

      // After sleep, check if the latest inbound message is still the same
      const { data: postMsg } = await supabaseAdmin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();

      if (postMsg?.id !== preMsgId) {
        console.log("Debounce: newer message arrived, skipping this AI call");
        return;
      }
    }

    // --- Fallback for media ---
    if (instSettings && incomingMediaType) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      let fallbackMsg = "";

      if (incomingMediaType === "image" && instSettings.fallback_image) {
        fallbackMsg = instSettings.fallback_image;
      } else if (incomingMediaType === "audio" && instSettings.fallback_audio) {
        fallbackMsg = instSettings.fallback_audio;
      }

      if (fallbackMsg) {
        // Send via Evolution
        if (evolutionUrl && evolutionKey && instanceEvolutionId) {
          const url = evolutionUrl.trim().replace(/\/+$/, "");
          console.log(`Sending fallback media message to ${contactPhone} at ${url}`);
          await fetch(`${url}/message/sendText/${instanceEvolutionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey.trim() },
            body: JSON.stringify({ number: contactPhone, text: fallbackMsg }),
          });
        }
        // Save as outbound
        await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          tenant_id: tenantId,
          direction: "outbound",
          content: fallbackMsg,
          is_ai_generated: true,
          sent_at: new Date().toISOString(),
        });
        await supabaseAdmin.from("conversations").update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", conversationId);
        console.log("Fallback sent for media type:", incomingMediaType);
        return; // Don't call AI for media
      }
    }

    // --- Typing indicator ---
    if (instSettings?.typing_enabled) {
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      if (evolutionUrl && evolutionKey && instanceEvolutionId) {
        try {
          const presenceBody = {
            number: contactPhone,
            delay: 5000,
            presence: "composing",
          };
          console.log("Sending typing to:", `${evolutionUrl.trim().replace(/\/+$/, "")}/chat/sendPresence/${instanceEvolutionId}`);
          const presenceRes = await fetch(`${evolutionUrl.trim().replace(/\/+$/, "")}/chat/sendPresence/${instanceEvolutionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey.trim() },
            body: JSON.stringify(presenceBody),
          });
          const presenceText = await presenceRes.text();
          console.log("Typing indicator response:", presenceRes.status, presenceText);
        } catch (e) {
          console.error("Typing indicator error:", e);
        }
      }
    }

    // --- Memory: load recent messages ---
    const memoryLimit = instSettings?.memory_enabled ? (instSettings.memory_messages_count || 20) : 10;
    const { data: recentMessages } = await supabaseAdmin
      .from("messages")
      .select("direction, content")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(memoryLimit);

    const chatMessages = (recentMessages || []).reverse().map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    }));

    // Load KB documents
    const { data: kbDocs } = await supabaseAdmin
      .from("kb_documents")
      .select("title, doc_type, content")
      .eq("tenant_id", tenantId)
      .eq("processing_status", "completed");

    // Load services for scheduling context
    const { data: services } = await supabaseAdmin
      .from("services")
      .select("id, name, description, duration_minutes, price_cents")
      .eq("tenant_id", tenantId)
      .eq("active", true);

    // Build system prompt
    const toneMap: Record<string, string> = {
      amigavel: "Seja amigável e informal, use emojis moderadamente.",
      profissional: "Seja profissional e direto, mantenha tom corporativo.",
      formal: "Seja formal e respeitoso, use linguagem culta.",
    };

    let systemPrompt = "Você é um assistente de atendimento via WhatsApp.\n\n";

    if (aiSettings) {
      const tone = toneMap[aiSettings.tone] || toneMap.amigavel;
      systemPrompt += `## Tom de Voz\n${tone}\n\n`;
      if (aiSettings.general_instructions) systemPrompt += `## Instruções Gerais\n${aiSettings.general_instructions}\n\n`;
      if (aiSettings.formatting_style) systemPrompt += `## Estilo de Formatação\n${aiSettings.formatting_style}\n\n`;
      if (aiSettings.greeting) systemPrompt += `## Saudação Padrão\nUse esta saudação ao iniciar: ${aiSettings.greeting}\n\n`;
      if (aiSettings.farewell) systemPrompt += `## Despedida Padrão\nUse esta despedida ao encerrar: ${aiSettings.farewell}\n\n`;
      if (aiSettings.forbidden_responses) systemPrompt += `## RESTRIÇÕES (NUNCA FAÇA ISSO)\n${aiSettings.forbidden_responses}\n\n`;
      if (aiSettings.human_trigger_words) systemPrompt += `## Palavras que exigem atendente humano\nSe o cliente mencionar: ${aiSettings.human_trigger_words}\nResponda que vai transferir para um atendente humano.\n\n`;
      if (aiSettings.business_type) systemPrompt += `## Tipo de Negócio\n${aiSettings.business_type}\n\n`;
      if (aiSettings.business_hours) systemPrompt += `## Horário de Funcionamento\n${aiSettings.business_hours}\n\n`;
    }

    if (kbDocs && kbDocs.length > 0) {
      systemPrompt += `## Base de Conhecimento\nUse as informações abaixo para responder perguntas dos clientes:\n\n`;
      for (const doc of kbDocs) {
        if (doc.content) systemPrompt += `### ${doc.title} (${doc.doc_type})\n${doc.content}\n\n`;
      }
    }

    // Add scheduling context
    if (services && services.length > 0) {
      systemPrompt += `## Serviços Disponíveis para Agendamento\n`;
      for (const svc of services) {
        const price = `R$ ${(svc.price_cents / 100).toFixed(2).replace(".", ",")}`;
        systemPrompt += `- ${svc.name}: ${svc.description || "Sem descrição"} | Duração: ${svc.duration_minutes} min | Preço: ${price} | ID: ${svc.id}\n`;
      }
      systemPrompt += `\n`;
    }

    systemPrompt += `## Agendamentos\nVocê pode ajudar clientes a agendar, consultar, alterar e cancelar horários usando as ferramentas (tools) disponíveis.\n`;
    systemPrompt += `- OBRIGATÓRIO: Antes de criar qualquer agendamento, pergunte o NOME COMPLETO do cliente. Nunca agende sem saber o nome.\n`;
    systemPrompt += `- Fluxo de NOVO agendamento: 1) Serviço 2) Data 3) Verificar disponibilidade 4) Horário 5) Nome completo 6) Resumo + "Posso confirmar?" 7) Aguardar SIM 8) Criar.\n`;
    systemPrompt += `- NUNCA chame create_schedule sem confirmação explícita do cliente (ex: "sim", "pode confirmar", "confirma", "ok").\n`;
    systemPrompt += `- Cancelamento durante o fluxo: Se o cliente disser "cancelar", "não quero mais", "desistir", "parar" durante o fluxo de agendamento, abandone o processo e confirme que foi cancelado. NÃO crie o agendamento.\n`;
    systemPrompt += `- Consulta de agendamentos: Quando o cliente quiser ver seus agendamentos, use list_schedules e apresente os dados formatados (data, horário, serviço).\n`;
    systemPrompt += `- Alteração de agendamento: Quando o cliente quiser remarcar/alterar, primeiro use list_schedules para mostrar os agendamentos, depois pergunte qual quer alterar e para qual nova data/horário. Use update_schedule para fazer a alteração. Peça confirmação antes de alterar.\n`;
    systemPrompt += `- Cancelamento de agendamento existente: Quando o cliente quiser cancelar um agendamento já marcado, use list_schedules para mostrar, pergunte qual cancelar, peça confirmação e use cancel_schedule.\n`;
    systemPrompt += `- Após obter o nome, use a ferramenta update_contact_name para salvar o nome do cliente.\n`;
    systemPrompt += `- Sempre pergunte a data desejada antes de verificar disponibilidade.\n`;
    systemPrompt += `- Use o ID do contato atual: ${contactPhone} (busque pelo telefone).\n`;
    systemPrompt += `- A data de hoje é: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} (${new Date().toISOString().split("T")[0]}).\n\n`;

    systemPrompt += "\n## Regras Finais\n" +
      "- Priorize SEMPRE as informações da 'Base de Conhecimento' acima para responder.\n" +
      "- Se a informação NÃO estiver na base de conhecimento ou nos serviços, informe educadamente que vai verificar com um atendente humano.\n" +
      "- Responda de forma natural a saudações (olá, bom dia, etc), mas direcione o assunto para o suporte baseado nos documentos ou agendamento.\n" +
      "- Mantenha respostas curtas e objetivas, ideais para leitura no celular (WhatsApp).\n" +
      "- Use Português do Brasil.\n" +
      "- IMPORTANTE: O WhatsApp NÃO suporta formatação Markdown complexa (hashtags #, listas com traço -, blocos de código, etc).\n" +
      "- Para destacar palavras, use apenas UM asterisco de cada lado: *exemplo*. NUNCA use dois asteriscos **.\n" +
      "- Não use negrito em frases longas, apenas em palavras-chave.\n" +
      "- Escreva texto limpo, direto e sem marcações de cabeçalho.";

    // Define scheduling tools for function calling
    const tools = [
      {
        type: "function",
        function: {
          name: "check_availability",
          description: "Verifica horários disponíveis para agendamento em uma data específica",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Data no formato YYYY-MM-DD" },
              service_id: { type: "string", description: "ID do serviço (opcional)" },
            },
            required: ["date"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_schedule",
          description: "Cria um novo agendamento para o cliente",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Data no formato YYYY-MM-DD" },
              time: { type: "string", description: "Horário no formato HH:MM" },
              service_id: { type: "string", description: "ID do serviço" },
              title: { type: "string", description: "Título/nome do agendamento" },
              description: { type: "string", description: "Descrição adicional (opcional)" },
            },
            required: ["date", "time"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_schedules",
          description: "Lista os próximos agendamentos do cliente",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
      {
        type: "function",
        function: {
          name: "cancel_schedule",
          description: "Cancela um agendamento do cliente",
          parameters: {
            type: "object",
            properties: {
              schedule_id: { type: "string", description: "ID do agendamento a cancelar" },
            },
            required: ["schedule_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_schedule",
          description: "Altera/remarca um agendamento existente. Pode mudar data, horário ou serviço.",
          parameters: {
            type: "object",
            properties: {
              schedule_id: { type: "string", description: "ID do agendamento a alterar" },
              date: { type: "string", description: "Nova data no formato YYYY-MM-DD (opcional)" },
              time: { type: "string", description: "Novo horário no formato HH:MM (opcional)" },
              service_id: { type: "string", description: "Novo ID do serviço (opcional)" },
            },
            required: ["schedule_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_contact_name",
          description: "Atualiza o nome do contato/cliente. Use quando o cliente informar seu nome.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome completo do cliente" },
            },
            required: ["name"],
          },
        },
      },
    ];

    // Find contact_id for this phone
    const { data: contactRecord } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone", contactPhone)
      .limit(1)
      .maybeSingle();
    const currentContactId = contactRecord?.id || null;

    // Call AI with function calling
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...chatMessages,
    ];

    let aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: aiMessages,
        tools,
        tool_choice: "auto",
        stream: false,
      }),
    });

    // Handle tool calls loop (max 3 iterations)
    let iterations = 0;
    let aiData = await aiResponse.json();
    let choice = aiData.choices?.[0];

    while (choice?.message?.tool_calls && iterations < 3) {
      // Process tool calls
      aiMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch { /* empty */ }

        let toolResult: any = { success: false, error: "Unknown tool" };

        if (fnName === "check_availability") {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              _action: "check_availability",
              tenant_id: tenantId,
              date: fnArgs.date,
              service_id: fnArgs.service_id,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "create_schedule" && currentContactId) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              _action: "create_schedule",
              tenant_id: tenantId,
              contact_id: currentContactId,
              date: fnArgs.date,
              time: fnArgs.time,
              service_id: fnArgs.service_id,
              title: fnArgs.title,
              description: fnArgs.description,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "list_schedules" && currentContactId) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              _action: "list_schedules",
              tenant_id: tenantId,
              contact_id: currentContactId,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "cancel_schedule" && currentContactId) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              _action: "cancel_schedule",
              tenant_id: tenantId,
              schedule_id: fnArgs.schedule_id,
              contact_id: currentContactId,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "update_schedule" && currentContactId) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              _action: "update_schedule",
              tenant_id: tenantId,
              schedule_id: fnArgs.schedule_id,
              contact_id: currentContactId,
              date: fnArgs.date,
              time: fnArgs.time,
              service_id: fnArgs.service_id,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "update_contact_name" && currentContactId) {
          const { error: updateErr } = await supabaseAdmin
            .from("contacts")
            .update({ name: fnArgs.name.trim() })
            .eq("id", currentContactId);
          toolResult = updateErr ? { success: false, error: "Erro ao atualizar nome" } : { success: true };
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Call AI again with tool results
      aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: aiMessages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });

      aiData = await aiResponse.json();
      choice = aiData.choices?.[0];
      iterations++;
    }

    // Extract final content
    let aiContent: string | null = choice?.message?.content || null;

    if (!aiContent) {
      console.error("AI returned empty content");
      return;
    }

    // --- Split long messages ---
    const messagesToSend: string[] = [];
    if (instSettings?.split_messages_enabled && aiContent.length > (instSettings.split_messages_limit || 1000)) {
      const limit = instSettings.split_messages_limit || 1000;
      let remaining = aiContent;
      while (remaining.length > 0) {
        if (remaining.length <= limit) {
          messagesToSend.push(remaining);
          break;
        }
        // Try to split at last newline or period before limit
        let splitIdx = remaining.lastIndexOf("\n", limit);
        if (splitIdx < limit * 0.3) splitIdx = remaining.lastIndexOf(". ", limit);
        if (splitIdx < limit * 0.3) splitIdx = limit;
        messagesToSend.push(remaining.substring(0, splitIdx + 1).trim());
        remaining = remaining.substring(splitIdx + 1).trim();
      }
    } else {
      messagesToSend.push(aiContent);
    }

    // Send via Evolution API
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    for (const msg of messagesToSend) {
      if (evolutionUrl && evolutionKey && instanceEvolutionId) {
        try {
          const url = evolutionUrl.trim().replace(/\/+$/, "");
          console.log(`Sending AI response part to ${contactPhone} at: ${url}`);
          console.log(`Using Key prefix: ${evolutionKey.trim().substring(0, 4)}...`);
          
          await fetch(`${url}/message/sendText/${instanceEvolutionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey.trim() },
            body: JSON.stringify({ number: contactPhone, text: msg }),
          });
        } catch (e) {
          console.error("Evolution send error:", e);
        }
      }

      // Save each part as outbound message
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: "outbound",
        content: msg,
        is_ai_generated: true,
        sent_at: new Date().toISOString(),
      });
    }

    // Update conversation timestamp
    await supabaseAdmin.from("conversations").update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);

    console.log("AI auto-response sent for conversation", conversationId, `(${messagesToSend.length} parts)`);
  } catch (e) {
    console.error("AI auto-response error:", e);
  }
}

type ExtractedMedia = {
  mediaType: string | null;
  mediaUrl: string | null;
};

function unwrapMessageVariants(rawData: any): any[] {
  const base = rawData?.message || {};
  return [
    base,
    base?.ephemeralMessage?.message,
    base?.viewOnceMessage?.message,
    base?.viewOnceMessageV2?.message,
    base?.viewOnceMessageV2Extension?.message,
  ].filter(Boolean);
}

function extractMessageText(rawData: any): string {
  const variants = unwrapMessageVariants(rawData);

  for (const msg of variants) {
    const text =
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      msg?.videoMessage?.caption ||
      msg?.documentMessage?.caption ||
      msg?.buttonsResponseMessage?.selectedDisplayText ||
      msg?.listResponseMessage?.title ||
      msg?.templateButtonReplyMessage?.selectedDisplayText;

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return "[Mídia]";
}

function extractMessageMedia(rawData: any): ExtractedMedia {
  const variants = unwrapMessageVariants(rawData);

  for (const msg of variants) {
    if (msg?.imageMessage) {
      return { mediaType: "image", mediaUrl: msg.imageMessage.url || null };
    }
    if (msg?.audioMessage) {
      return { mediaType: "audio", mediaUrl: msg.audioMessage.url || null };
    }
    if (msg?.videoMessage) {
      return { mediaType: "video", mediaUrl: msg.videoMessage.url || null };
    }
    if (msg?.documentMessage) {
      return { mediaType: "document", mediaUrl: msg.documentMessage.url || null };
    }
  }

  return { mediaType: null, mediaUrl: null };
}

function normalizePhoneFromJid(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).substring(0, 500));

    const event = body.event?.toLowerCase?.() || body.event;
    const instanceName = body.instance;
    const data = body.data;

    if (!event || !data) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the WhatsApp instance
    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, tenant_id, evolution_instance_id")
      .or(`evolution_instance_id.eq.${instanceName},instance_name.eq.${instanceName}`)
      .single();

    if (!instance) {
      console.error("Instance not found:", instanceName);
      return new Response(JSON.stringify({ success: false, error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore status-only updates to avoid creating fake "[Mídia]" messages
    if (event === "messages.update") {
      return new Response(JSON.stringify({ success: true, message: "Message update ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle inbound/outbound message creation
    if (event === "messages.upsert") {
      const remoteJid = data?.key?.remoteJid || body?.sender;
      const fromMe = Boolean(data?.key?.fromMe);
      const messageContent = extractMessageText(data);
      const { mediaType, mediaUrl } = extractMessageMedia(data);

      if (!remoteJid) {
        return new Response(JSON.stringify({ success: true, message: "No remoteJid, skipped" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ignore groups for now
      if (String(remoteJid).includes("@g.us")) {
        return new Response(JSON.stringify({ success: true, message: "Group message ignored" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phone = normalizePhoneFromJid(String(remoteJid));

      // Find or create contact (safe against duplicates/race conditions)
      let { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("tenant_id", instance.tenant_id)
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!contact) {
        const { data: newContact, error: contactInsertErr } = await supabaseAdmin
          .from("contacts")
          .insert({
            tenant_id: instance.tenant_id,
            phone,
            name: data?.pushName || phone,
          })
          .select("id")
          .single();

        if (contactInsertErr) {
          // Conflict/race: another webhook created this contact first
          const { data: existingContact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("tenant_id", instance.tenant_id)
            .eq("phone", phone)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          contact = existingContact;
        } else {
          contact = newContact;
        }
      }

      if (!contact) {
        return new Response(JSON.stringify({ success: false, error: "Failed to get/create contact" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find or create conversation (1 thread per contact + instance)
      let { data: conversation } = await supabaseAdmin
        .from("conversations")
        .select("id, status")
        .eq("tenant_id", instance.tenant_id)
        .eq("contact_id", contact.id)
        .eq("instance_id", instance.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Legacy fallback: old rows created without instance_id
      if (!conversation) {
        const { data: legacyConversation } = await supabaseAdmin
          .from("conversations")
          .select("id, status")
          .eq("tenant_id", instance.tenant_id)
          .eq("contact_id", contact.id)
          .is("instance_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (legacyConversation) {
          await supabaseAdmin
            .from("conversations")
            .update({
              instance_id: instance.id,
              status: legacyConversation.status === "closed" ? "open" : legacyConversation.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", legacyConversation.id);

          conversation = {
            ...legacyConversation,
            status: legacyConversation.status === "closed" ? "open" : legacyConversation.status,
          };
        }
      }

      if (!conversation) {
        const { data: newConv, error: insertErr } = await supabaseAdmin
          .from("conversations")
          .insert({
            tenant_id: instance.tenant_id,
            contact_id: contact.id,
            instance_id: instance.id,
            status: "open",
            last_message_at: new Date().toISOString(),
          })
          .select("id, status")
          .single();

        if (insertErr) {
          // Unique conflict/race: fetch the existing conversation
          const { data: existing } = await supabaseAdmin
            .from("conversations")
            .select("id, status")
            .eq("tenant_id", instance.tenant_id)
            .eq("contact_id", contact.id)
            .eq("instance_id", instance.id)
            .limit(1)
            .maybeSingle();
          conversation = existing;
        } else {
          conversation = newConv;
        }
      }

      if (!conversation) {
        return new Response(JSON.stringify({ success: false, error: "Failed to get/create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert message
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversation.id,
        tenant_id: instance.tenant_id,
        direction: fromMe ? "outbound" : "inbound",
        content: messageContent,
        media_type: mediaType,
        media_url: mediaUrl,
        sent_at: new Date().toISOString(),
      });

      // Wait for conversation update data
      const updateData: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // --- Admin Pause Control (Triggered by atendente/outbound) ---
      if (fromMe) {
        const { data: instSettings } = await supabaseAdmin
          .from("instance_settings")
          .select("pause_words, resume_words")
          .eq("instance_id", instance.id)
          .maybeSingle();

        if (instSettings) {
          const pauseWords = (instSettings.pause_words || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
          const resumeWords = (instSettings.resume_words || "").split(",").map((w: string) => w.trim().toLowerCase()).filter(Boolean);
          const content = (messageContent || "").toLowerCase().trim();

          if (pauseWords.includes(content)) {
            console.log(`Bot PAUSED by admin for conversation ${conversation.id}`);
            updateData.status = "pending";
          } else if (resumeWords.includes(content)) {
            console.log(`Bot RESUMED by admin for conversation ${conversation.id}`);
            updateData.status = "open";
          }
        }
      }

      if (!fromMe) {
        const { data: currentConv } = await supabaseAdmin
          .from("conversations")
          .select("unread_count")
          .eq("id", conversation.id)
          .maybeSingle();
        updateData.unread_count = (currentConv?.unread_count || 0) + 1;
        if (conversation.status === "closed") {
          updateData.status = "open";
        }
      }

      await supabaseAdmin
        .from("conversations")
        .update(updateData)
        .eq("id", conversation.id);

      // Trigger AI auto-response for inbound messages (non-blocking)
      if (!fromMe) {
        generateAIResponse(
          supabaseAdmin,
          instance.tenant_id,
          conversation.id,
          instance.evolution_instance_id,
          phone,
          instance.id,
          mediaType,
        ).catch((e) => console.error("Background AI error:", e));
      }

      return new Response(JSON.stringify({ success: true, message: "Message processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle connection status updates
    if (event === "connection.update") {
      const state = data.state;
      let status = "disconnected";
      if (state === "open") status = "connected";
      else if (state === "connecting") status = "connecting";
      else if (state === "close") status = "disconnected";

      await supabaseAdmin
        .from("whatsapp_instances")
        .update({ status, updated_at: new Date().toISOString() })
        .or(`evolution_instance_id.eq.${instanceName},instance_name.eq.${instanceName}`);

      return new Response(JSON.stringify({ success: true, message: "Status updated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Event ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
