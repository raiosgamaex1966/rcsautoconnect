import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Window in minutes: only send if within this range of the target time
const SEND_WINDOW_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Get all enabled reminders (each has its own offset_minutes)
    const { data: allReminders, error: remErr } = await supabase
      .from("reminders")
      .select("*")
      .eq("enabled", true);

    if (remErr || !allReminders || allReminders.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active reminders", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group reminders by tenant
    const remindersByTenant: Record<string, typeof allReminders> = {};
    for (const r of allReminders) {
      if (!remindersByTenant[r.tenant_id]) remindersByTenant[r.tenant_id] = [];
      remindersByTenant[r.tenant_id].push(r);
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const [tenantId, tenantReminders] of Object.entries(remindersByTenant)) {
      for (const reminder of tenantReminders) {
        // Use offset_minutes from the reminder itself (fully custom)
        const offsetMinutes = reminder.offset_minutes;
        if (!offsetMinutes || offsetMinutes <= 0) continue;

        // Target: schedules happening in exactly `offsetMinutes` from now (± window)
        const targetStart = new Date(now.getTime() + (offsetMinutes - SEND_WINDOW_MINUTES) * 60000);
        const targetEnd = new Date(now.getTime() + (offsetMinutes + SEND_WINDOW_MINUTES) * 60000);

        // Find qualifying schedules
        const { data: schedules } = await supabase
          .from("schedules")
          .select("id, title, scheduled_at, duration_minutes, contact_id, contact:contacts(name, phone)")
          .eq("tenant_id", tenantId)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", targetStart.toISOString())
          .lte("scheduled_at", targetEnd.toISOString());

        if (!schedules || schedules.length === 0) continue;

        for (const schedule of schedules) {
          // Check if already sent
          const { data: existing } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("schedule_id", schedule.id)
            .eq("reminder_key", reminder.reminder_key)
            .maybeSingle();

          if (existing) continue;

          const contact = schedule.contact as any;
          if (!contact?.phone) continue;

          // Build message from template
          const scheduledDate = new Date(schedule.scheduled_at);
          const dia = scheduledDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          const hora = scheduledDate.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

          const message = (reminder.message || "")
            .replace(/\{nome\}/g, contact.name || "Cliente")
            .replace(/\{servico\}/g, schedule.title || "Serviço")
            .replace(/\{dia\}/g, dia)
            .replace(/\{hora\}/g, hora)
            .replace(/\{data\}/g, dia);

          if (!message) continue;

          // Find a connected WhatsApp instance for this tenant
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("evolution_instance_id")
            .eq("tenant_id", tenantId)
            .eq("status", "connected")
            .limit(1)
            .maybeSingle();

          if (!instance?.evolution_instance_id || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            console.log(`No connected instance for tenant ${tenantId}, skipping`);
            continue;
          }

          // Send via Evolution API
          try {
            const url = EVOLUTION_API_URL!.trim().replace(/\/+$/, "");
            console.log(`Sending reminder to ${contact.phone} via Evolution at: ${url}`);
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
              console.error(`Failed to send reminder to ${contact.phone}:`, errText);
              errors.push(`${contact.phone}: ${sendRes.status}`);
              continue;
            }

            // Log as sent
            await supabase.from("reminder_logs").insert({
              schedule_id: schedule.id,
              reminder_key: reminder.reminder_key,
              tenant_id: tenantId,
            });

            // Also save as outbound message in conversation
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
              await supabase.from("conversations").update({
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", conversation.id);
            }

            totalSent++;
            console.log(`Reminder [${reminder.reminder_key}] (${offsetMinutes}min) sent to ${contact.phone} for schedule ${schedule.id}`);
          } catch (e) {
            console.error(`Error sending reminder:`, e);
            errors.push(`${contact.phone}: ${e}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: { sent: totalSent, errors: errors.length, error_details: errors },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reminders error:", e);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
