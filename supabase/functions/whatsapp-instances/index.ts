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

  const rawPlan = (sub as any)?.plans;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

  const maxInstancesRaw = Number(plan?.max_instances ?? 0);
  const maxInstances = Number.isFinite(maxInstancesRaw) && maxInstancesRaw > 0 ? maxInstancesRaw : 0;

  const hasActiveSubscription = (sub as any)?.status === "active" || (sub as any)?.status === "trial";

  return { maxInstances, accessBlocked: !hasActiveSubscription };
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

    const { data: membership } = await adminClient
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", auth.userId)
      .maybeSingle();

    let tenantId = membership?.tenant_id;
    
    // Check global admin as well
    const { data: globalAdmin } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = membership?.role === "admin" || !!globalAdmin;

    if (!tenantId) return jsonResponse({ success: false, error: "No tenant found" }, 403);

    const body = req.method === "POST" ? await req.json() : {};
    const action = body._action || new URL(req.url).searchParams.get("action") || "list";

    console.log(`[DEBUG] Action: ${action}, Tenant: ${tenantId}, User: ${auth.userId}`);

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
      const { instance_name, channel_type = "whatsapp" } = body;
      const normalizedInstanceName = instance_name?.trim();
      
      if (!normalizedInstanceName) {
        return jsonResponse({ success: false, error: "Nome da instância é obrigatório" }, 400);
      }

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!evolutionUrl || !evolutionKey) {
        console.error("[ERROR] EVOLUTION_API_URL or KEY missing");
        return jsonResponse({ success: false, error: "Erro de configuração: Evolution API não configurada." }, 500);
      }

      // Prepare Evolution Name
      const shortTenantId = tenantId.split("-")[0];
      const safeName = normalizedInstanceName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const evoInstanceName = `${shortTenantId}_${safeName}_${Date.now()}`;

      console.log(`[CREATE] Target URL: ${evolutionUrl}/instance/create`);
      console.log(`[CREATE] Instance Name: ${evoInstanceName}, Type: ${channel_type}`);

      try {
        const payload = {
          instanceName: evoInstanceName,
          integration: channel_type === "instagram" ? "instagram" : "WHATSAPP-BAILEYS",
          qrcode: channel_type !== "instagram",
        };

        const evoRes = await fetch(`${evolutionUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify(payload),
        });

        const evoText = await evoRes.text();
        console.log(`[CREATE] Evolution Response (${evoRes.status}): ${evoText}`);

        if (!evoRes.ok) {
          // Try to parse error message if it's JSON
          let errorMsg = evoText;
          try {
            const errJson = JSON.parse(evoText);
            errorMsg = errJson.message || errJson.error || evoText;
          } catch {}
          
          return jsonResponse({ success: false, error: `Evolution: ${errorMsg}` }, 500);
        }

        const evoData = JSON.parse(evoText);
        const finalEvoId = evoData.instance?.instanceName || evoInstanceName;

        const { data: instance, error: insertErr } = await adminClient
          .from("whatsapp_instances")
          .insert({
            tenant_id: tenantId,
            instance_name: normalizedInstanceName,
            evolution_instance_id: finalEvoId,
            status: "disconnected",
            channel_type: channel_type,
            qr_code: evoData.qrcode?.base64 || null,
          })
          .select()
          .single();

        if (insertErr) {
          console.error("[CREATE] DB Insert Error:", insertErr);
          return jsonResponse({ success: false, error: "Erro ao salvar no banco: " + insertErr.message }, 500);
        }

        // Webhook
        const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        try {
          await fetch(`${evolutionUrl}/webhook/set/${finalEvoId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evolutionKey },
            body: JSON.stringify({
              webhook: {
                enabled: true,
                url: webhookUrl,
                events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
                byEvents: false, base64: false, webhook_by_events: false, webhook_base64: false, headers: {},
              }
            }),
          });
        } catch (e) {}

        return jsonResponse({ success: true, data: instance });
      } catch (err: any) {
        console.error("[CREATE] Fatal Fetch Error:", err);
        return jsonResponse({ success: false, error: `Erro na rede: ${err.message}` }, 500);
      }
    }

    // CONNECT
    if (action === "connect") {
      const { instance_id, username, password } = body;
      const { data: inst } = await adminClient.from("whatsapp_instances").select("*").eq("id", instance_id).single();
      if (!inst) return jsonResponse({ success: false, error: "Instância não encontrada" }, 404);

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

      let connectUrl = `${evolutionUrl}/instance/connect/${inst.evolution_instance_id}`;
      let options: any = { headers: { "apikey": evolutionKey } };

      if (inst.channel_type === "instagram") {
        connectUrl = `${evolutionUrl}/instance/connect/instagram/${inst.evolution_instance_id}`;
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify({ username, password }),
        };
      }

      const res = await fetch(connectUrl, options);
      const text = await res.text();
      console.log(`[CONNECT] Status: ${res.status}, Body: ${text}`);

      if (res.ok) {
        const data = JSON.parse(text);
        await adminClient.from("whatsapp_instances").update({ status: "connecting" }).eq("id", instance_id);
        return jsonResponse({ success: true, data: { qr_code: data.base64 || null } });
      }
      return jsonResponse({ success: false, error: text }, 500);
    }

    // DELETE
    if (action === "delete") {
      const { instance_id } = body;
      const { data: inst } = await adminClient.from("whatsapp_instances").select("*").eq("id", instance_id).single();
      if (inst) {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        try {
          await fetch(`${evolutionUrl}/instance/delete/${inst.evolution_instance_id}`, { method: "DELETE", headers: { "apikey": evolutionKey } });
        } catch (e) {}
        await adminClient.from("whatsapp_instances").delete().eq("id", instance_id);
      }
      return jsonResponse({ success: true });
    }

    // SEND MESSAGE
    if (action === "send-message") {
      const { conversation_id, content } = body;
      if (!conversation_id || !content) {
        return jsonResponse({ success: false, error: "Dados incompletos" }, 400);
      }

      const { data: conv, error: convErr } = await adminClient
        .from("conversations")
        .select("*, contact:contacts(phone), instance:whatsapp_instances(evolution_instance_id, instance_name)")
        .eq("id", conversation_id)
        .single();

      if (convErr || !conv) {
        return jsonResponse({ success: false, error: "Conversa não encontrada" }, 404);
      }

      if (conv.tenant_id !== tenantId) {
        return jsonResponse({ success: false, error: "Acesso negado a esta conversa" }, 403);
      }

      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      
      const instanceName = (conv.instance as any)?.evolution_instance_id || (conv.instance as any)?.instance_name;
      const phone = (conv.contact as any)?.phone;
      const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;

      try {
        const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": evolutionKey },
          body: JSON.stringify({
            number: remoteJid,
            text: content,
            delay: 1000
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[SEND] Evolution Error:", errText);
          return jsonResponse({ success: false, error: `Erro na Evolution API: ${errText}` }, 500);
        }

        await adminClient.from("messages").insert({
          conversation_id,
          tenant_id: tenantId,
          direction: "outbound",
          content,
          is_ai_generated: false,
          sent_at: new Date().toISOString()
        });

        return jsonResponse({ success: true });
      } catch (err: any) {
        console.error("[SEND] Fatal Error:", err);
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    return jsonResponse({ success: false, error: "Action not found" }, 400);
  } catch (err: any) {
    console.error("[FATAL ERROR]", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
});
