import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: authUser.id };

    const { messages, tenant_id, contact_id } = await req.json();
    if (!messages || !Array.isArray(messages) || !tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user is tenant member
    const { data: isMember } = await adminClient.rpc("is_tenant_member", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load AI settings
    const { data: aiSettings } = await adminClient
      .from("ai_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Get OpenAI API key and model from tenant settings
    const openaiApiKey = aiSettings?.openai_api_key;
    const openaiModel = aiSettings?.openai_model || "gpt-4o-mini";

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ success: false, error: "Chave da API OpenAI não configurada. Vá em Configurações para adicionar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load KB documents content
    const { data: kbDocs } = await adminClient
      .from("kb_documents")
      .select("title, doc_type, content")
      .eq("tenant_id", tenant_id)
      .eq("processing_status", "completed");

    // Load services for scheduling context
    const { data: services } = await adminClient
      .from("services")
      .select("id, name, description, duration_minutes, price_cents")
      .eq("tenant_id", tenant_id)
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

      if (aiSettings.general_instructions) {
        systemPrompt += `## Instruções Gerais\n${aiSettings.general_instructions}\n\n`;
      }
      if (aiSettings.formatting_style) {
        systemPrompt += `## Estilo de Formatação\n${aiSettings.formatting_style}\n\n`;
      }
      if (aiSettings.greeting) {
        systemPrompt += `## Saudação Padrão\nUse esta saudação ao iniciar: ${aiSettings.greeting}\n\n`;
      }
      if (aiSettings.farewell) {
        systemPrompt += `## Despedida Padrão\nUse esta despedida ao encerrar: ${aiSettings.farewell}\n\n`;
      }
      if (aiSettings.forbidden_responses) {
        systemPrompt += `## RESTRIÇÕES (NUNCA FAÇA ISSO)\n${aiSettings.forbidden_responses}\n\n`;
      }
      if (aiSettings.human_trigger_words) {
        systemPrompt += `## Palavras que exigem atendente humano\nSe o cliente mencionar: ${aiSettings.human_trigger_words}\nResponda que vai transferir para um atendente humano.\n\n`;
      }
      if (aiSettings.business_type) {
        systemPrompt += `## Tipo de Negócio\n${aiSettings.business_type}\n\n`;
      }
      if (aiSettings.business_hours) {
        systemPrompt += `## Horário de Funcionamento\n${aiSettings.business_hours}\n\n`;
      }
    }

    if (kbDocs && kbDocs.length > 0) {
      systemPrompt += `## Base de Conhecimento\nUse as informações abaixo para responder perguntas dos clientes:\n\n`;
      for (const doc of kbDocs) {
        if (doc.content) {
          systemPrompt += `### ${doc.title} (${doc.doc_type})\n${doc.content}\n\n`;
        }
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
    systemPrompt += `- Consulta de agendamentos: Quando o cliente quiser ver seus agendamentos, use list_schedules e apresente os dados formatados.\n`;
    systemPrompt += `- A data de hoje é: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} (${new Date().toISOString().split("T")[0]}).\n\n`;

    systemPrompt += "\n## Regras Finais\n" +
      "- Priorize SEMPRE as informações da 'Base de Conhecimento' acima para responder.\n" +
      "- Se a informação NÃO estiver na base de conhecimento ou serviços, informe educadamente que vai verificar com um atendente humano.\n" +
      "- Mantenha respostas curtas e objetivas, ideais para leitura no celular (WhatsApp).\n" +
      "- Use Português do Brasil.\n" +
      "- Para destacar palavras, use apenas UM asterisco de cada lado: *exemplo*. NUNCA use dois asteriscos **.";

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

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Initial call to check for tool usage
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
        stream: false, // Don't stream if checking for tools
      }),
    });

    if (!aiResponse.ok) {
        // ... (error handling already below)
        const errText = await aiResponse.text();
        console.error("OpenAI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ success: false, error: "Erro na API da OpenAI" }), {
          status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let aiData = await aiResponse.json();
    let choice = aiData.choices?.[0];
    let iterations = 0;

    // Tool processing loop
    while (choice?.message?.tool_calls && iterations < 3) {
      aiMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any = {};
        try { fnArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* empty */ }

        let toolResult: any = { success: false, error: "Unknown tool" };

        if (fnName === "check_availability") {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _action: "check_availability",
              tenant_id: tenant_id,
              date: fnArgs.date,
              service_id: fnArgs.service_id,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "create_schedule" && contact_id) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _action: "create_schedule",
              tenant_id: tenant_id,
              contact_id: contact_id,
              date: fnArgs.date,
              time: fnArgs.time,
              service_id: fnArgs.service_id,
              title: fnArgs.title,
              description: fnArgs.description,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "list_schedules" && contact_id) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _action: "list_schedules",
              tenant_id: tenant_id,
              contact_id: contact_id,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "cancel_schedule" && contact_id) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-scheduling`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _action: "cancel_schedule",
              tenant_id: tenant_id,
              schedule_id: fnArgs.schedule_id,
              contact_id: contact_id,
            }),
          });
          toolResult = await res.json();
        } else if (fnName === "update_contact_name" && contact_id) {
          const { error: updateErr } = await adminClient
            .from("contacts")
            .update({ name: fnArgs.name.trim() })
            .eq("id", contact_id);
          toolResult = updateErr ? { success: false, error: "Erro ao atualizar nome" } : { success: true };
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Re-call AI with tool results
      aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
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

    // Final call to get a STREAMING response if it's the final content
    const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: aiMessages,
        stream: true,
      }),
    });

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
