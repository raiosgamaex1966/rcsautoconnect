import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/+$/, "");
    const EVO_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();

    // 1. Get enabled reminders
    const { data: reminders } = await db.from("reminders").select("*").eq("enabled", true);
    if (!reminders?.length) return new Response("No active reminders", { status: 200 });

    const results = [];

    for (const reminder of reminders) {
      const { tenant_id, reminder_key, offset_minutes, message: template } = reminder;

      // Target time window
      const now = new Date();
      // Adjust targetTime based on offset_minutes
      const targetTime = new Date(now.getTime() + offset_minutes * 60000);
      
      // Look for schedules within a 30m window around targetTime (e.g. target - 30m to target + 30m)
      // This allows the function to run every 30-60m and catch everyone.
      const windowStart = new Date(targetTime.getTime() - 30 * 60000);
      const windowEnd = new Date(targetTime.getTime() + 30 * 60000);

      console.log(`[Reminder] Checking ${reminder_key} for tenant ${tenant_id}. Window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

      const { data: schedules } = await db.from("schedules")
        .select("id, contact_id, title, scheduled_at, contacts(name, phone)")
        .eq("tenant_id", tenant_id)
        .eq("status", "pending")
        .gte("scheduled_at", windowStart.toISOString())
        .lte("scheduled_at", windowEnd.toISOString());

      if (!schedules?.length) continue;

      // Get connected instance for this tenant
      const { data: instance } = await db.from("whatsapp_instances")
        .select("evolution_instance_id")
        .eq("tenant_id", tenant_id)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (!instance?.evolution_instance_id) {
        console.warn(`[Reminder] No connected instance for tenant ${tenant_id}`);
        continue;
      }

      for (const sched of schedules) {
        // Check if already sent
        const { data: log } = await db.from("reminder_logs")
          .select("id")
          .eq("schedule_id", sched.id)
          .eq("reminder_key", reminder_key)
          .maybeSingle();

        if (log) {
          console.log(`[Reminder] Already sent ${reminder_key} for schedule ${sched.id}`);
          continue;
        }

        const contact = (sched.contacts as any);
        if (!contact?.phone) continue;

        // Format message
        let text = template || `Olá {nome}, confirmamos seu agendamento de {servico} para {data} às {hora}? Responda SIM para confirmar ou NÃO para cancelar.`;
        
        // Use pt-BR for formatting
        const dt = new Date(sched.scheduled_at);
        // Brazil Timezone adjustment (if needed, but usually Supabase stores UTC and we format here)
        const dateStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        text = text
          .replace(/{nome}/g, contact.name || "Cliente")
          .replace(/{servico}/g, sched.title || "Procedimento")
          .replace(/{data}/g, dateStr)
          .replace(/{hora}/g, timeStr);

        // Send via Evolution
        const remoteJid = contact.phone.includes("@") ? contact.phone : `${contact.phone}@s.whatsapp.net`;
        console.log(`[Reminder] Sending to ${remoteJid}: ${text}`);
        
        const res = await fetch(`${EVO_URL}/message/sendText/${instance.evolution_instance_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_KEY },
          body: JSON.stringify({
            number: remoteJid,
            text: text
          })
        });

        if (res.ok) {
          // Log it
          await db.from("reminder_logs").insert({
            schedule_id: sched.id,
            reminder_key: reminder_key,
            tenant_id: tenant_id
          });
          
          // Also record as an outbound message in messages table so it appears in Chat
          // 1. Find conversation
          const { data: conv } = await db.from("conversations")
            .select("id")
            .eq("contact_id", sched.contact_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .maybeSingle();
            
          if (conv) {
            await db.from("messages").insert({
              conversation_id: conv.id,
              tenant_id: tenant_id,
              direction: "outbound",
              content: text,
              is_ai_generated: false // It's automated, not AI chat
            });
          }

          results.push({ schedule_id: sched.id, status: "sent" });
        } else {
          console.error(`[Reminder] Failed to send to ${contact.phone}:`, await res.text());
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: results.length }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("[Reminder] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
