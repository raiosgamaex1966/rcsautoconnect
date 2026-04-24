import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate user token
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: authUser.id };

    const { schedule_id, reminder_id } = await req.json();

    if (!schedule_id || !reminder_id) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload: schedule_id and reminder_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user tenant
    const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get reminder
    const { data: reminder } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", reminder_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!reminder) {
      return new Response(JSON.stringify({ success: false, error: "Reminder not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get schedule with contact
    const { data: schedule } = await supabase
      .from("schedules")
      .select("id, title, scheduled_at, duration_minutes, contact_id, contact:contacts(name, phone)")
      .eq("id", schedule_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!schedule) {
      return new Response(JSON.stringify({ success: false, error: "Schedule not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contact = schedule.contact as any;
    if (!contact?.phone) {
      return new Response(JSON.stringify({ success: false, error: "Contact has no phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message
    const scheduledDate = new Date(schedule.scheduled_at);
    const dia = scheduledDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const hora = scheduledDate.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    const message = (reminder.message || "")
      .replace(/\{nome\}/g, contact.name || "Cliente")
      .replace(/\{servico\}/g, schedule.title || "Serviço")
      .replace(/\{dia\}/g, dia)
      .replace(/\{hora\}/g, hora)
      .replace(/\{data\}/g, dia);

    if (!message) {
      return new Response(JSON.stringify({ success: false, error: "Empty message after template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp instance
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("evolution_instance_id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!instance?.evolution_instance_id || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "No connected WhatsApp instance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Evolution API
    const url = EVOLUTION_API_URL!.trim().replace(/\/+$/, "");
    console.log(`Resending reminder to ${contact.phone} at: ${url}`);
    console.log(`Using Key prefix: ${EVOLUTION_API_KEY!.trim().substring(0, 4)}...`);

    const sendRes = await fetch(
      `${url}/message/sendText/${instance.evolution_instance_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY!.trim() },
        body: JSON.stringify({ number: contact.phone, text: message }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error(`Failed to resend reminder to ${contact.phone}:`, errText);
      return new Response(JSON.stringify({ success: false, error: `Send failed: ${sendRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the resend
    await supabase.from("reminder_logs").insert({
      schedule_id: schedule.id,
      reminder_key: reminder.reminder_key + "_resend",
      tenant_id: tenantId,
    });

    // Save in conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("contact_id", schedule.contact_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversation) {
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        direction: "outbound",
        content: message,
        is_ai_generated: true,
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, data: { sent_to: contact.phone } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resend-reminder error:", e);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
