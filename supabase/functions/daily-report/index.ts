import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/+$/, "");
    const EVO_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { tenant_id, phone_to_send } = await req.json();

    if (!tenant_id) return new Response("Missing tenant_id", { status: 400 });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString();

    // 1. Fetch Metrics
    const [msgs, scheds, convs] = await Promise.all([
      db.from("messages").select("direction, is_ai_generated").eq("tenant_id", tenant_id).gte("sent_at", yesterdayISO),
      db.from("schedules").select("title, scheduled_at, status").eq("tenant_id", tenant_id).gte("created_at", yesterdayISO),
      db.from("conversations").select("sentiment").eq("tenant_id", tenant_id).gte("last_message_at", yesterdayISO),
    ]);

    const totalMsgs = msgs.data?.length || 0;
    const inbound = msgs.data?.filter(m => m.direction === "inbound").length || 0;
    const aiResponded = msgs.data?.filter(m => m.is_ai_generated).length || 0;
    
    const sentimentCounts = (convs.data || []).reduce((acc: any, curr: any) => {
      const s = curr.sentiment || "neutro";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, { satisfeito: 0, neutro: 0, irritado: 0, duvida: 0 });

    const newSchedules = scheds.data || [];

    // 2. Format Message
    let message = `📊 *RCS AUTOCONNECT - RELATÓRIO DIÁRIO EXECUTIVO*\n`;
    message += `📅 Período: ${yesterday.toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}\n\n`;
    
    message += `📈 *MOVIMENTAÇÃO*\n`;
    message += `- Total de Mensagens: ${totalMsgs}\n`;
    message += `- Clientes Atendidos: ${inbound}\n`;
    message += `- Respostas da IA: ${aiResponded} (${((aiResponded/inbound)*100 || 0).toFixed(1)}% de automação)\n\n`;

    message += `😊 *HUMOR DOS CLIENTES*\n`;
    message += `- Satisfeitos: ${sentimentCounts.satisfeito}\n`;
    message += `- Neutros: ${sentimentCounts.neutro}\n`;
    message += `- Dúvidas: ${sentimentCounts.duvida}\n`;
    message += `- Irritados: ${sentimentCounts.irritado} ⚠️\n\n`;

    message += `📅 *NOVOS AGENDAMENTOS (${newSchedules.length})*\n`;
    if (newSchedules.length > 0) {
      newSchedules.forEach(s => {
        const dt = new Date(s.scheduled_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
        message += `- ${s.title} (${dt})\n`;
      });
    } else {
      message += `- Nenhum novo agendamento hoje.\n`;
    }

    message += `\n🚀 *RCS AutoConnect: Inteligência que escala o seu negócio.*`;

    // 3. Send to WhatsApp
    const targetPhone = phone_to_send;
    if (!targetPhone) return new Response(JSON.stringify({ success: false, error: "No phone number provided" }), { status: 400 });

    const remoteJid = targetPhone.includes("@") ? targetPhone : `${targetPhone}@s.whatsapp.net`;
    
    // Get a connected instance to send from
    const { data: inst, error: instError } = await db.from("whatsapp_instances")
      .select("instance_name, evolution_instance_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (instError) {
      console.error("[Report] DB Error finding instance:", instError);
      return new Response(JSON.stringify({ success: false, error: "Database error finding instance" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!inst) {
      console.warn("[Report] No connected instance found for tenant:", tenant_id);
      return new Response(JSON.stringify({ success: false, error: "Nenhuma instância conectada encontrada para enviar o relatório. Conecte o WhatsApp primeiro." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Evolution API usually expects the ID/Name used during creation
    const instanceToUse = inst.evolution_instance_id || inst.instance_name;
    console.log(`[Report] Sending via instance: ${instanceToUse} to ${remoteJid}`);

    const evoRes = await fetch(`${EVO_URL}/message/sendText/${instanceToUse}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({
        number: remoteJid,
        text: message,
        options: { delay: 1000 }
      })
    });

    const evoStatus = evoRes.status;
    const evoText = await evoRes.text();
    console.log(`[Report] Evolution API Response (${evoStatus}):`, evoText);

    if (!evoRes.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Erro na Evolution API (${evoStatus}). Verifique se a instância '${instanceToUse}' está ativa na API.`,
        details: evoText
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, message: "Report sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
