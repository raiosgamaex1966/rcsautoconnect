import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/+$/, "");
const EVO_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── STEP 1: Download media base64 from Evolution API ───────────────────────
async function downloadMedia(instance: string, message: any, convId: string, tenantId: string): Promise<{ b64: string; mime: string } | null> {
  if (!EVO_URL || !EVO_KEY) return null;
  
  // List of possible endpoints for different Evolution API versions
  const endpoints = [
    `/message/getBase64FromMediaMessage/${instance}`,
    `/chat/getBase64FromMediaMessage/${instance}`,
    `/message/convert/getBase64/${instance}`
  ];

  for (const path of endpoints) {
    try {
      const url = `${EVO_URL}${path}`;
      console.log(`[Media] Trying ${url}`);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVO_KEY },
        body: JSON.stringify({ message: { key: message.key, message: message.message } }),
      });

      if (res.ok) {
        const json = await res.json();
        const raw: string = json.base64 || "";
        if (raw) {
          const parts = raw.split(",");
          const b64 = parts.length > 1 ? parts[1] : parts[0];
          const mime = parts.length > 1 ? (parts[0].split(":")[1]?.split(";")[0] || "application/octet-stream") : "application/octet-stream";
          console.log(`[Media] Success using ${path}`);
          return { b64, mime };
        }
      } else {
        console.warn(`[Media] Path ${path} failed with status ${res.status}`);
      }
    } catch (e) {
      console.error(`[Media] Error on ${path}:`, e);
    }
  }

  // If all failed, log the last error to DB for the user
  await db.from("messages").insert({
    conversation_id: convId, tenant_id: tenantId, direction: "outbound",
    content: `⚠️ Erro: Não foi possível baixar a mídia da Evolution API. Verifique se a URL da API está correta.`,
    is_ai_generated: false
  });
  
  return null;
}


// ─── STEP 2a: Upload to Supabase Storage → public URL ───────────────────────
async function uploadToStorage(b64: string, mime: string, mediaType: string): Promise<string | null> {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const extMap: Record<string, string> = { audio: "ogg", image: "jpg", video: "mp4", document: "bin", sticker: "webp" };
    const ext = mime.split("/")[1]?.split(";")[0]?.split("+")[0] || extMap[mediaType] || "bin";
    const path = `${mediaType}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const blob = new Blob([bytes], { type: mime });
    const { error } = await db.storage.from("whatsapp-media").upload(path, blob, { contentType: mime, upsert: false });
    if (error) { console.error("[Storage] upload error:", error.message); return null; }
    const { data } = db.storage.from("whatsapp-media").getPublicUrl(path);
    console.log("[Storage] uploaded:", data.publicUrl);
    return data.publicUrl;
  } catch (e) { console.error("[Storage] exception:", e); return null; }
}

// ─── STEP 2b: Transcribe audio → text (Whisper) ─────────────────────────────
async function transcribeAudio(b64: string, mime: string, apiKey: string, convId: string, tenantId: string): Promise<string | null> {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Whisper works best with explicitly named extensions
    const form = new FormData();
    const blob = new Blob([bytes], { type: "audio/ogg" });
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", 
      headers: { "Authorization": `Bearer ${apiKey}` }, 
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Whisper] Error:", err);
      // Log error to conversation for debugging
      await db.from("messages").insert({
        conversation_id: convId, tenant_id: tenantId, direction: "outbound",
        content: `⚠️ Erro Transcrição: ${err.substring(0, 100)}`,
        is_ai_generated: false
      });
      return null;
    }

    const json = await res.json();
    return json.text || null;
  } catch (e: any) {
    console.error("[Whisper] Exception:", e);
    return null;
  }
}

// ─── STEP 2c: Describe image → text (GPT-4o Vision) ─────────────────────────
async function describeImage(b64: string, mime: string, apiKey: string, caption: string, convId: string, tenantId: string): Promise<string | null> {
  try {
    const prompt = caption
      ? `O cliente enviou esta imagem com a legenda: "${caption}". Descreva o que há nela e como isso se relaciona com a legenda para o atendimento.`
      : "Descreva brevemente o que há nesta imagem e o que o cliente provavelmente deseja com base nela.";

    // Ensure we have a valid image mime type
    const finalMime = mime.startsWith("image/") ? mime : "image/jpeg";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ 
          role: "user", 
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${finalMime};base64,${b64}`, detail: "low" } },
          ]
        }],
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Vision] Error:", err);
      // Log error to conversation for debugging
      await db.from("messages").insert({
        conversation_id: convId, tenant_id: tenantId, direction: "outbound",
        content: `⚠️ Erro Visão: ${err.substring(0, 100)}`,
        is_ai_generated: false
      });
      return null;
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    console.error("[Vision] Exception:", e);
    return null;
  }
}

// ─── STEP 3: Generate AI text response ──────────────────────────────────────
async function aiRespond(tenantId: string, convId: string, instanceName: string, phone: string) {
  try {
    console.log(`[AI] Starting response for conv=${convId} instance=${instanceName}`);
    const { data: ai } = await db.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    
    if (!ai?.ai_enabled || !ai?.openai_api_key) {
      console.log("[AI] Disabled or no key");
      return;
    }

    // 1. Prepare Context
    const { data: kbDocs } = await db.from("kb_documents")
      .select("title, content")
      .eq("tenant_id", tenantId)
      .eq("processing_status", "completed")
      .limit(10);

    let sys = `Você é um assistente de atendimento inteligente.\n${ai.general_instructions || ""}\nTom: ${ai.tone || "Amigável"}\nResponda em Português do Brasil.`;
    if (kbDocs?.length) {
      sys += "\n\nCONHECIMENTO BASE PARA CONSULTA:\n" + kbDocs.map((d: any) => `[${d.title}]\n${d.content}`).join("\n\n");
    }

    // 2. Get History (protect against nulls)
    const { data: msgs } = await db.from("messages")
      .select("direction, content")
      .eq("conversation_id", convId)
      .order("sent_at", { ascending: false })
      .limit(15);

    const history = (msgs || [])
      .reverse()
      .filter(m => m.content) // Only messages with text
      .map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content
      }));

    if (history.length === 0) {
      console.warn("[AI] No history found to respond to");
      return;
    }

    // 3. Call OpenAI
    const now = new Date();
    const nowStr = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${ai.openai_api_key}`,
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: ai.openai_model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: sys + `\n\nDATA/HORA ATUAL: ${nowStr}\n\n` +
            "REGRAS ESPECIAIS:\n" +
            "1. TRANSFERÊNCIA: Se o cliente quiser falar com humano, use a tag [TRANSFER].\n" +
            "2. AGENDAMENTO: Se o cliente confirmar um serviço e horário, responda confirmando e adicione a tag: [SCHEDULE: Nome do Serviço | YYYY-MM-DD HH:mm:ss | Duração em Minutos].\n" +
            "Exemplo: [SCHEDULE: Limpeza de Pele | 2026-04-25 14:30:00 | 60]"
          }, 
          ...history
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("[AI] OpenAI Error:", errorText);
      await db.from("messages").insert({
        conversation_id: convId, tenant_id: tenantId, direction: "outbound",
        content: `⚠️ Erro IA (OpenAI): ${errorText.substring(0, 100)}`,
        is_ai_generated: false
      });
      return;
    }

    const json = await openAiRes.json();
    let reply = json.choices?.[0]?.message?.content;
    if (!reply) return;

    // 4. Handle Special Tags
    // a) Transfer
    if (reply.includes("[TRANSFER]")) {
      reply = reply.replace("[TRANSFER]", "").trim();
      await db.from("conversations").update({ status: "pending" }).eq("id", convId);
    }

    // b) Schedule
    if (reply.includes("[SCHEDULE:")) {
      const match = reply.match(/\[SCHEDULE:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\]/);
      if (match) {
        const [fullTag, title, dateTime, duration] = match;
        reply = reply.replace(fullTag, "").trim();
        
        try {
          console.log(`[AI] Auto-scheduling: ${title} at ${dateTime}`);
          
          // 1. Get contact and an admin for this tenant to "sign" the creation
          const { data: conv } = await db.from("conversations").select("contact_id").eq("id", convId).single();
          const { data: admin } = await db.from("tenant_members")
            .select("user_id")
            .eq("tenant_id", tenantId)
            .eq("role", "admin")
            .limit(1)
            .single();

          if (!admin) {
             throw new Error("Não foi possível encontrar um administrador para este tenant.");
          }

          // 2. Insert the schedule
          const { error: schedErr } = await db.from("schedules").insert({
            tenant_id: tenantId,
            contact_id: conv?.contact_id,
            title: `${title} (${phone})`, // Added phone here!
            scheduled_at: new Date(dateTime).toISOString(),
            duration_minutes: parseInt(duration) || 30,
            status: "pending",
            created_by: admin.user_id,
            description: `Agendado automaticamente pela IA - Telefone: ${phone}`
          });

          if (schedErr) {
            console.error("[AI] Schedule Insert Error:", schedErr);
            await db.from("messages").insert({
              conversation_id: convId, tenant_id: tenantId, direction: "outbound",
              content: `⚠️ Erro ao gravar na agenda: ${schedErr.message}`,
              is_ai_generated: false
            });
          } else {
            console.log("[AI] Schedule created successfully");
          }
        } catch (err: any) {
          console.error("[AI] Schedule Exception:", err);
          await db.from("messages").insert({
            conversation_id: convId, tenant_id: tenantId, direction: "outbound",
            content: `⚠️ Exceção na agenda: ${err.message}`,
            is_ai_generated: false
          });
        }
      }
    }

    // 5. Send via Evolution
    const fullJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
    const evoRes = await fetch(`${EVO_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ 
        number: fullJid, 
        text: reply,
        options: { delay: 1000, presence: "composing" }
      }),
    });

    if (!evoRes.ok) {
      const evoErr = await evoRes.text();
      console.error("[AI] Evolution Send Error:", evoErr);
      await db.from("messages").insert({
        conversation_id: convId, tenant_id: tenantId, direction: "outbound",
        content: `⚠️ Erro Evolution: ${evoErr.substring(0, 100)}`,
        is_ai_generated: false
      });
      return;
    }

    // 5. Success! Save to DB
    await db.from("messages").insert({
      conversation_id: convId,
      tenant_id: tenantId,
      direction: "outbound",
      content: reply,
      is_ai_generated: true,
      sent_at: new Date().toISOString()
    });

    console.log("[AI] Success. Reply sent to", phone);

  } catch (e: any) {
    console.error("[AI] Fatal Exception:", e);
    await db.from("messages").insert({
      conversation_id: convId, tenant_id: tenantId, direction: "outbound",
      content: `⚠️ Erro Fatal: ${e.message}`,
      is_ai_generated: false
    });
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const event = body.event?.toLowerCase();
    const instanceName: string = body.instance;
    console.log(`[Webhook] event=${event} instance=${instanceName}`);

    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = body.data;
    const message = data.messages?.[0] || data;
    const phone: string = (message.key?.remoteJid || "").split("@")[0].split(":")[0];
    const fromMe: boolean = !!message.key?.fromMe;

    // ── Node 1: Find instance ────────────────────────────────────────────────
    const { data: inst } = await db.from("whatsapp_instances")
      .select("*").or(`evolution_instance_id.eq.${instanceName},instance_name.eq.${instanceName}`).maybeSingle();
    if (!inst) { console.warn("[N1] Instance not found:", instanceName); return new Response("OK", { status: 200 }); }

    // ── Node 2: Detect media type ────────────────────────────────────────────
    const msg = message.message || {};
    const mediaType: string | null =
      msg.imageMessage   ? "image"    :
      msg.audioMessage   ? "audio"    :
      msg.videoMessage   ? "video"    :
      msg.documentMessage? "document" :
      msg.stickerMessage ? "sticker"  : null;
    const caption: string = msg.imageMessage?.caption || msg.videoMessage?.caption || msg.documentMessage?.caption || "";
    const rawText: string = caption || msg.conversation || msg.extendedTextMessage?.text || "";

    // ── Node 3: Get/Create Contact ───────────────────────────────────────────
    let { data: contact } = await db.from("contacts").select("id").eq("tenant_id", inst.tenant_id).eq("phone", phone).maybeSingle();
    if (!contact && !fromMe) {
      const { data: nc } = await db.from("contacts").insert({ tenant_id: inst.tenant_id, phone, name: phone }).select("id").single();
      contact = nc;
    }
    if (!contact) return new Response("OK", { status: 200 });

    // ── Node 4: Get/Create Conversation ─────────────────────────────────────
    let { data: conv } = await db.from("conversations").select("id, status").eq("contact_id", contact.id).eq("instance_id", inst.id).maybeSingle();
    if (!conv) {
      const { data: nc } = await db.from("conversations").insert({ contact_id: contact.id, instance_id: inst.id, tenant_id: inst.tenant_id, status: "open" }).select("id, status").single();
      conv = nc;
    }
    if (!conv) return new Response("OK", { status: 200 });

    // ── Node 5: MEDIA PROCESSING ────────────────────────────────────────
    let finalContent = rawText || (mediaType ? `[${mediaType}]` : "");
    let mediaPublicUrl: string | null = null;
    let mediaDownloaded: { b64: string; mime: string } | null = null;

    if (mediaType && !fromMe) {
      console.log(`[N5] Media detected type=${mediaType} instance=${instanceName}`);

      // Node 5a: Use instanceName ("bot") NOT the UUID from DB
      mediaDownloaded = await downloadMedia(instanceName, message, conv.id, inst.tenant_id);

      if (mediaDownloaded) {
        // Node 5b: Upload to Supabase Storage → public URL
        mediaPublicUrl = await uploadToStorage(mediaDownloaded.b64, mediaDownloaded.mime, mediaType);

        // Get AI key
        const { data: aiSettings } = await db.from("ai_settings").select("openai_api_key, ai_enabled").eq("tenant_id", inst.tenant_id).maybeSingle();
        const apiKey = aiSettings?.openai_api_key;

        if (apiKey && aiSettings?.ai_enabled) {
          if (mediaType === "audio") {
            const transcription = await transcribeAudio(mediaDownloaded.b64, mediaDownloaded.mime, apiKey, conv.id, inst.tenant_id);
            if (transcription) {
              finalContent = `🎤 Áudio: "${transcription}"`;
              console.log("[N5] Transcribed:", transcription.substring(0, 60));
            }
          } else if (mediaType === "image") {
            const description = await describeImage(mediaDownloaded.b64, mediaDownloaded.mime, apiKey, caption, conv.id, inst.tenant_id);
            if (description) {
              finalContent = `📸 Imagem: "${description}"`;
              console.log("[N5] Described image");
            }
          } else if (mediaType === "sticker") {
            const description = await describeImage(mediaDownloaded.b64, mediaDownloaded.mime, apiKey, caption);
            if (description) {
              finalContent = caption ? `🖼️ Imagem (${caption}): ${description}` : `🖼️ Imagem: ${description}`;
              console.log("[N5] Described:", description.substring(0, 60));
            }
          }
        }
      } else {
        console.warn(`[N5] Download returned null. instanceName=${instanceName} mediaType=${mediaType}`);
      }
    }

    // ── Node 6: Save message to DB ───────────────────────────────────────────
    await db.from("messages").insert({
      conversation_id: conv.id,
      tenant_id: inst.tenant_id,
      direction: "inbound",
      content: finalContent,
      media_type: mediaType,
      media_url: mediaPublicUrl,
      sent_at: new Date(message.messageTimestamp * 1000).toISOString(),
    });

    // Update conversation
    await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
    console.log(`[N6] Message saved. content="${finalContent.substring(0, 60)}" media_url=${mediaPublicUrl || "null"}`);

    // ── Node 7: AI Response (only for inbound, non-pending) ──────────────────
    if (!fromMe && conv.status !== "pending") {
      // Use instanceName ("bot") NOT the UUID
      aiRespond(inst.tenant_id, conv.id, instanceName, phone)
        .catch(e => console.error("[N7] AI error:", e));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[Webhook] Critical:", err);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
