import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  
  // LOG: Check if SERVICE_ROLE_KEY is valid JWT (doing it here to have access to env)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (serviceRoleKey && serviceRoleKey.startsWith("sbp_")) {
    console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is a Personal Access Token (sbp_...), NOT a service_role secret. Database operations will FAIL.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  return { userId: user.id, client: userClient };
}


function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getTenantPlanContext(adminClient: any, tenantId: string) {
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("status, plans(price_cents, max_instances, max_messages)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: sysSettings } = await adminClient
    .from("system_settings")
    .select("auto_trial")
    .limit(1)
    .maybeSingle();

  const autoTrialEnabled = sysSettings?.auto_trial ?? true;

  const rawPlan = (sub as any)?.plans;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

  const maxInstancesRaw = Number(plan?.max_instances ?? 0);
  const maxInstances = Number.isFinite(maxInstancesRaw) && maxInstancesRaw > 0 ? maxInstancesRaw : 0;

  const maxMessagesRaw = plan?.max_messages;
  const maxMessages = maxMessagesRaw === null || maxMessagesRaw === undefined
    ? null
    : Number.isFinite(Number(maxMessagesRaw))
      ? Math.max(0, Number(maxMessagesRaw))
      : null;

  const planPrice = Number(plan?.price_cents ?? 0);
  const isFreePlan = planPrice === 0;
  const trialBlocked = isFreePlan && !autoTrialEnabled;
  const hasActiveSubscription = (sub as any)?.status === "active" || (sub as any)?.status === "trial";
  const accessBlocked = !hasActiveSubscription || trialBlocked;

  return { maxInstances, maxMessages, trialBlocked, accessBlocked };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is admin
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    // 2. Get tenant
    const { data: membership } = await adminClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", auth.userId)
      .maybeSingle();

    let tenantId = membership?.tenant_id;

    if (!tenantId) {
      if (isAdmin) {
        // Fallback for admins: use the first tenant available
        const { data: firstTenant } = await adminClient.from("tenants").select("id").limit(1).maybeSingle();
        if (firstTenant) {
          tenantId = firstTenant.id;
        } else {
          return jsonResponse({ success: false, error: "No tenant found in system" }, 403);
        }
      } else {
        return jsonResponse({ success: false, error: "No tenant found" }, 403);
      }
    }

    // Parse body and action
    const body = req.method === "POST" ? await req.json() : {};
    const action = body._action || new URL(req.url).searchParams.get("action") || "list";

    const actionsThatRequireActivePlan = new Set([
      "create",
      "connect",
      "send-message",
      "set-webhook",
      "update-settings",
    ]);

    const planContext = (!isAdmin && actionsThatRequireActivePlan.has(action))
      ? await getTenantPlanContext(adminClient, tenantId)
      : null;

    if (planContext?.accessBlocked) {
      return jsonResponse(
        {
          success: false,
          error: planContext.trialBlocked
            ? "Trial gratuito desativado para o plano Grátis. Faça upgrade para continuar."
            : "Assinatura inativa. Faça upgrade para continuar.",
        },
        403,
      );
    }

    // LIST
    if (action === "list") {
      const { data, error } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) return jsonResponse({ success: false, error: error.message }, 500);
      return jsonResponse({ success: true, data });
    }

    // CREATE
    if (action === "create") {
      const { instance_name } = body;
      if (typeof instance_name !== "string" || !instance_name.trim()) {
        return jsonResponse({ success: false, error: "instance_name required" }, 400);
      }

      const normalizedInstanceName = instance_name.trim();
      const maxInstances = isAdmin ? Infinity : (planContext?.maxInstances ?? 0);
      if (maxInstances <= 0) {
        return jsonResponse({ success: false, error: "Seu plano atual não permite criar instâncias" }, 403);
      }

      const { count } = await adminClient
        .from("whatsapp_instances")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if ((count || 0) >= maxInstances) {
        return jsonResponse({ success: false, error: `Limite de ${maxInstances} instância(s) atingido no seu plano` }, 400);
      }

      const { data: instance, error: insertErr } = await adminClient
        .from("whatsapp_instances")
        .insert({
          tenant_id: tenantId,
          instance_name: normalizedInstanceName,
          status: "disconnected",
        })
        .select()
        .single();

      if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 500);

      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");

        if (!evolutionUrl || !evolutionKey) {
          console.error("ERRO: EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados no Supabase.");
          return jsonResponse({ 
            success: false, 
            error: "Configuração da Evolution API ausente no Supabase Secrets. Use 'npx supabase secrets set' para configurar." 
          }, 400);
        }

        const evoInstanceName = `${tenantId}_${instance.id}`;
        console.log(`Creating instance in Evolution: ${evoInstanceName} at ${evolutionUrl}`);
        console.log(`Using API Key starting with: ${evolutionKey!.trim().substring(0, 4)}...`);
        
        const evoRes = await fetch(`${evolutionUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify({
            instanceName: evoInstanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        });

        if (!evoRes.ok) {
          const errText = await evoRes.text();
          console.error("Evolution API error:", evoRes.status, errText);
          return jsonResponse({ 
            success: false, 
            error: `Erro na Evolution API (${evoRes.status}): ${errText}` 
          }, 500);
        }

        const evoData = await evoRes.json();
        const finalInstanceName = evoData.instance?.instanceName || evoInstanceName;

        await adminClient.from("whatsapp_instances").update({
          evolution_instance_id: finalInstanceName,
          qr_code: evoData.qrcode?.base64 || null,
          status: "connecting",
        }).eq("id", instance.id);

        instance.evolution_instance_id = finalInstanceName;
        instance.status = "connecting";
        instance.qr_code = evoData.qrcode?.base64 || null;

        // Register webhook for this instance
        const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        const webhookEvents = [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
        ];

        try {
          const webhookPayload = {
            webhook: {
              enabled: true,
              url: webhookUrl,
              events: webhookEvents,
              byEvents: false,
              base64: false,
              webhook_by_events: false,
              webhook_base64: false,
              headers: {},
            },
          };

          const webhookRes = await fetch(`${evolutionUrl}/webhook/set/${finalInstanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evolutionKey },
            body: JSON.stringify(webhookPayload),
          });
          const webhookText = await webhookRes.text();

          if (!webhookRes.ok) {
            console.error("Failed to register webhook:", webhookRes.status, webhookText);
          } else {
            console.log("Webhook registered for instance:", finalInstanceName, "->", webhookUrl);
          }
        } catch (whErr) {
          console.error("Failed to register webhook request:", whErr);
        }

      } catch (err: any) {
        console.error("Connection to Evolution API failed:", err);
        return jsonResponse({ 
          success: false, 
          error: `Não foi possível conectar à Evolution API: ${err.message}. Verifique se a URL e a Chave estão corretas no Supabase Secrets.` 
        }, 500);
      }

      return jsonResponse({ success: true, data: instance });
    }

    // CONNECT
    if (action === "connect") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!evolutionUrl || !evolutionKey) {
        return jsonResponse({ 
          success: false, 
          error: "Configuração da Evolution API ausente no Supabase Secrets (URL ou KEY)." 
        }, 400);
      }

      if (!inst.evolution_instance_id) {
        return jsonResponse({ 
          success: false, 
          error: "Esta instância não possui um ID da Evolution API. Por favor, exclua e crie uma nova." 
        }, 400);
      }

      console.log("Connecting instance:", inst.evolution_instance_id);
      
      const evoRes = await fetch(
        `${evolutionUrl}/instance/connect/${inst.evolution_instance_id}`,
        { headers: { "apikey": evolutionKey } }
      );
      
      if (evoRes.ok) {
        const evoData = await evoRes.json();
        await adminClient.from("whatsapp_instances").update({
          qr_code: evoData.base64 || null,
          status: "connecting",
        }).eq("id", instance_id);

        return jsonResponse({ success: true, data: { qr_code: evoData.base64 } });
      }

      const errText = await evoRes.text();
      return jsonResponse({ 
        success: false, 
        error: `Erro ao conectar com a Evolution API: ${evoRes.status} ${errText}` 
      }, 500);
    }

    // CHECK STATUS (polling)
    if (action === "check-status") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      console.log("check-status for:", inst.evolution_instance_id, "current DB status:", inst.status);

      if (evolutionUrl && evolutionKey && inst.evolution_instance_id) {
        try {
          const evoRes = await fetch(
            `${evolutionUrl}/instance/connectionState/${inst.evolution_instance_id}`,
            { headers: { "apikey": evolutionKey } }
          );
          const evoText = await evoRes.text();
          console.log("Evolution connectionState response:", evoRes.status, evoText);

          if (evoRes.ok) {
            const evoData = JSON.parse(evoText);
            const state = evoData?.instance?.state || evoData?.state || "";
            console.log("Parsed state:", state);
            let newStatus: string = inst.status;
            let phone: string | null = inst.phone;

            if (state === "open" || state === "connected") {
              newStatus = "connected";
              try {
                const infoRes = await fetch(
                  `${evolutionUrl}/instance/fetchInstances?instanceName=${inst.evolution_instance_id}`,
                  { headers: { "apikey": evolutionKey } }
                );
                if (infoRes.ok) {
                  const infoData = await infoRes.json();
                  console.log("fetchInstances response:", JSON.stringify(infoData).substring(0, 500));
                  const instanceInfo = Array.isArray(infoData) ? infoData[0] : infoData;
                  const rawOwner = instanceInfo?.ownerJid
                    || instanceInfo?.instance?.owner
                    || instanceInfo?.owner
                    || instanceInfo?.instance?.wuid
                    || "";
                  // Clean phone: remove @s.whatsapp.net, @lid, :XX suffixes
                  const cleanPhone = String(rawOwner).split("@")[0].split(":")[0];
                  if (cleanPhone) phone = cleanPhone;
                }
              } catch (e) {
                console.error("fetchInstances error:", e);
              }
            } else if (state === "close" || state === "disconnected") {
              newStatus = "disconnected";
            }

            console.log("newStatus:", newStatus, "phone:", phone, "prevStatus:", inst.status, "prevPhone:", inst.phone);

            // Always update if status or phone changed
            if (newStatus !== inst.status || phone !== inst.phone) {
              await adminClient.from("whatsapp_instances").update({
                status: newStatus as any,
                phone: phone,
                ...(newStatus === "connected" ? { qr_code: null } : {}),
              }).eq("id", instance_id);
            }

            return jsonResponse({ success: true, data: { status: newStatus, phone } });
          }
        } catch (e) {
          console.error("Check status error:", e);
        }
      } else {
        console.log("Evolution API not configured or no evolution_instance_id");
      }

      return jsonResponse({ success: true, data: { status: inst.status, phone: inst.phone } });
    }

    // DISCONNECT
    if (action === "disconnect") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (evolutionUrl && evolutionKey && inst.evolution_instance_id) {
        try {
          const evoRes = await fetch(`${evolutionUrl}/instance/logout/${inst.evolution_instance_id}`, {
            method: "DELETE", headers: { "apikey": evolutionKey },
          });
          if (!evoRes.ok) {
            console.error("Evolution API logout failed:", evoRes.status, await evoRes.text());
          }
        } catch (e) {
          console.error("Evolution API fetch error during logout:", e);
        }
      }

      await adminClient.from("whatsapp_instances").update({
        status: "disconnected", qr_code: null,
      }).eq("id", instance_id);

      return jsonResponse({ success: true, data: { message: "Disconnected" } });
    }

    // DELETE
    if (action === "delete") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (evolutionUrl && evolutionKey && inst.evolution_instance_id) {
        await fetch(`${evolutionUrl}/instance/delete/${inst.evolution_instance_id}`, {
          method: "DELETE", headers: { "apikey": evolutionKey },
        });
      }

      await adminClient.from("whatsapp_instances").delete().eq("id", instance_id);
      return jsonResponse({ success: true, data: { message: "Deleted" } });
    }

    // SEND MESSAGE
    if (action === "send-message") {
      const { conversation_id, content } = body;
      if (!conversation_id || typeof content !== "string") {
        return jsonResponse({ success: false, error: "conversation_id and content required" }, 400);
      }

      const cleanContent = content.trim();
      if (!cleanContent) {
        return jsonResponse({ success: false, error: "Mensagem vazia não é permitida" }, 400);
      }

      const { data: conv } = await adminClient
        .from("conversations")
        .select("*, contact:contacts(*), instance:whatsapp_instances(*)")
        .eq("id", conversation_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!conv) return jsonResponse({ success: false, error: "Conversation not found" }, 404);

      const maxMessages = planContext?.maxMessages;
      if (maxMessages !== null && maxMessages !== undefined) {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { count: messageCount } = await adminClient
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", monthStart);

        if ((messageCount || 0) >= maxMessages) {
          return jsonResponse({
            success: false,
            error: `Limite mensal de ${maxMessages} mensagem(ns) atingido no seu plano`,
          }, 400);
        }
      }

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const instance = conv.instance as any;

      if (evolutionUrl && evolutionKey && instance?.evolution_instance_id) {
        const contact = conv.contact as any;
        const phone = contact?.phone;
        if (phone) {
          try {
            await fetch(`${evolutionUrl}/message/sendText/${instance.evolution_instance_id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evolutionKey },
              body: JSON.stringify({ number: phone, text: cleanContent }),
            });
          } catch (e) {
            console.error("Evolution send error:", e);
          }
        }
      }

      const { data: msg, error: msgErr } = await adminClient
        .from("messages")
        .insert({
          conversation_id,
          tenant_id: tenantId,
          direction: "outbound",
          content: cleanContent,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (msgErr) return jsonResponse({ success: false, error: msgErr.message }, 500);

      await adminClient.from("conversations").update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversation_id);

      return jsonResponse({ success: true, data: msg });
    }

    // SET WEBHOOK (for existing instances)
    if (action === "set-webhook") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");

      if (evolutionUrl && evolutionKey && inst.evolution_instance_id) {
        const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        const webhookEvents = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"];
        const webhookPayload = {
          webhook: {
            enabled: true,
            url: webhookUrl,
            events: webhookEvents,
            byEvents: false,
            base64: false,
            webhook_by_events: false,
            webhook_base64: false,
            headers: {},
          },
        };

        const evoRes = await fetch(`${evolutionUrl}/webhook/set/${inst.evolution_instance_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify(webhookPayload),
        });
        const evoData = await evoRes.text();
        console.log("Set webhook result:", evoRes.status, evoData);

        if (!evoRes.ok) {
          return jsonResponse({ success: false, error: `Falha ao configurar webhook: ${evoData}` }, 400);
        }

        return jsonResponse({ success: true, data: { message: "Webhook configured", url: webhookUrl } });
      }

      return jsonResponse({ success: false, error: "Evolution API not configured" }, 400);
    }

    // GET SETTINGS
    if (action === "get-settings") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      // Verify instance belongs to tenant
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("id")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();
      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      // Get or create settings
      let { data: settings } = await adminClient
        .from("instance_settings")
        .select("*")
        .eq("instance_id", instance_id)
        .single();

      if (!settings) {
        const { data: newSettings, error: createErr } = await adminClient
          .from("instance_settings")
          .insert({ instance_id, tenant_id: tenantId })
          .select()
          .single();
        if (createErr) return jsonResponse({ success: false, error: createErr.message }, 500);
        settings = newSettings;
      }

      return jsonResponse({ success: true, data: settings });
    }

    // UPDATE SETTINGS
    if (action === "update-settings") {
      const { instance_id, settings } = body;
      if (!instance_id || !settings) return jsonResponse({ success: false, error: "instance_id and settings required" }, 400);

      // Verify instance belongs to tenant
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("id")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();
      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);

      // Allowed fields
      const allowed = [
        "debounce_enabled", "debounce_seconds",
        "split_messages_enabled", "split_messages_limit",
        "memory_enabled", "memory_messages_count",
        "typing_enabled",
        "fallback_image", "fallback_audio",
        "pause_words", "resume_words",
      ];
      const updateData: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in settings) updateData[key] = settings[key];
      }

      // Upsert
      const { data: existing } = await adminClient
        .from("instance_settings")
        .select("id")
        .eq("instance_id", instance_id)
        .single();

      if (existing) {
        const { error: updateErr } = await adminClient
          .from("instance_settings")
          .update(updateData)
          .eq("instance_id", instance_id);
        if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 500);
      } else {
        const { error: insertErr } = await adminClient
          .from("instance_settings")
          .insert({ instance_id, tenant_id: tenantId, ...updateData });
        if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 500);
      }

      return jsonResponse({ success: true, data: { message: "Settings updated" } });
    }

    // FIND CONTACTS from Evolution API
    if (action === "find-contacts") {
      const { instance_id } = body;
      if (!instance_id) return jsonResponse({ success: false, error: "instance_id required" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!inst) return jsonResponse({ success: false, error: "Instance not found" }, 404);
      if (inst.status !== "connected") {
        return jsonResponse({ success: false, error: "Instância não está conectada" }, 400);
      }

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!evolutionUrl || !evolutionKey || !inst.evolution_instance_id) {
        return jsonResponse({ success: false, error: "Evolution API não configurada" }, 400);
      }

      try {
        const evoRes = await fetch(
          `${evolutionUrl}/chat/findContacts/${inst.evolution_instance_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evolutionKey },
            body: JSON.stringify({}),
          }
        );

        if (!evoRes.ok) {
          const errText = await evoRes.text();
          console.error("Evolution findContacts error:", evoRes.status, errText);
          return jsonResponse({ success: false, error: "Erro ao buscar contatos da Evolution API" }, 500);
        }

        const evoContacts = await evoRes.json();
        // evoContacts is an array of { id, remoteJid, pushName, profilePicUrl, ... }
        const contacts = (Array.isArray(evoContacts) ? evoContacts : [])
          .filter((c: any) => {
            const jid = c.remoteJid || c.id || "";
            // Filter only individual contacts (not groups/status)
            return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("status@");
          })
          .map((c: any) => {
            const jid = c.remoteJid || c.id || "";
            const phone = jid.replace("@s.whatsapp.net", "");
            return {
              name: c.pushName || c.verifiedName || c.name || phone,
              phone,
              profilePicUrl: c.profilePicUrl || null,
            };
          });

        return jsonResponse({ success: true, data: contacts });
      } catch (e) {
        console.error("find-contacts error:", e);
        return jsonResponse({ success: false, error: "Erro interno ao buscar contatos" }, 500);
      }
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (err) {
    console.error("whatsapp-instances error:", err);
    return jsonResponse({ success: false, error: "Internal error" }, 500);
  }
});
