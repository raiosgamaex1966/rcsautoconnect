import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// LOG: Check if SERVICE_ROLE_KEY is valid JWT
if (SUPABASE_SERVICE_ROLE_KEY.startsWith("sbp_")) {
  console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is a Personal Access Token (sbp_...), NOT a service_role secret. Database operations will FAIL.");
}

function extractMessageMedia(message: any) {
  const mediaType = message.message?.imageMessage ? "image" :
                   message.message?.audioMessage ? "audio" :
                   message.message?.videoMessage ? "video" :
                   message.message?.documentMessage ? "document" :
                   message.message?.stickerMessage ? "sticker" : null;

  const mediaUrl = message.message?.imageMessage?.url || 
                  message.message?.audioMessage?.url ||
                  message.message?.videoMessage?.url ||
                  message.message?.documentMessage?.url ||
                  message.message?.stickerMessage?.url;

  const caption = message.message?.imageMessage?.caption || 
                  message.message?.videoMessage?.caption || 
                  message.message?.documentMessage?.caption || "";

  return { mediaType, mediaUrl, caption };
}

async function getEvolutionMedia(instanceName: string, messageKey: any): Promise<{ data: string, mimeType: string } | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("[Evolution] Missing API URL or Key for media download");
    return null;
  }
  try {
    const url = `${EVOLUTION_API_URL.trim().replace(/\/+$/, "")}/message/getBase64FromMediaMessage/${instanceName}`;
    console.log(`[Evolution] Downloading media from ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY.trim()
      },
      body: JSON.stringify({ message: { key: messageKey } })
    });
    
    if (!response.ok) {
      console.error(`[Evolution] Media download failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const result = await response.json();
    if (result.base64) {
      const parts = result.base64.split(",");
      const data = parts.length > 1 ? parts[1] : parts[0];
      const mimeType = parts.length > 1 ? parts[0].split(":")[1].split(";")[0] : "application/octet-stream";
      console.log(`[Evolution] Media downloaded successfully. Type: ${mimeType}, Size: ${data.length} chars`);
      return { data, mimeType };
    }
    console.warn("[Evolution] No base64 data in media response");
    return null;
  } catch (e) {
    console.error("[Evolution] Media Download Error:", e);
    return null;
  }
}

async function transcribeAudio(audioData: string, mimeType: string, apiKey: string): Promise<string | null> {
  try {
    const formData = new FormData();
    const ext = mimeType.split("/")[1]?.split(";")[0] || "ogg";
    
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-1");

    console.log(`[Whisper] Transcribing audio, size: ${bytes.length} bytes, type: ${mimeType}`);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("[Whisper] Error response:", err);
      return null;
    }
    const result = await response.json();
    console.log("[Whisper] Result:", result.text);
    return result.text;
  } catch (e) {
    console.error("[Whisper] Error:", e);
    return null;
  }
}

async function generateAIResponse(
  tenantId: string,
  conversationId: string,
  instanceEvolutionId: string | null,
  contactPhone: string,
  instanceId: string,
  incomingMediaType: string | null,
  messageKey: any,
  messageText: string | null,
) {
  try {
    console.log(`[AI] Starting response generation for tenant ${tenantId}, conv ${conversationId}`);
    
    const { data: aiSettings, error: aiErr } = await supabaseAdmin
      .from("ai_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (aiErr) {
      console.error("[AI] Error fetching settings:", aiErr);
      return;
    }

    if (!aiSettings || !aiSettings.ai_enabled || !aiSettings.openai_api_key) {
      console.log("[AI] AI is disabled or missing API key for this tenant.");
      return;
    }

    const processViaAI = (incomingMediaType === "image" && aiSettings.image_understanding_enabled) ||
                         (incomingMediaType === "audio" && aiSettings.audio_transcription_enabled);

    let mediaData: { data: string, mimeType: string } | null = null;
    if (processViaAI && instanceEvolutionId) {
      mediaData = await getEvolutionMedia(instanceEvolutionId, messageKey);
    }

    let userMessage = messageText || "";
    if (mediaData && incomingMediaType === "audio") {
      const transcription = await transcribeAudio(mediaData.data, mediaData.mimeType, aiSettings.openai_api_key);
      if (transcription) {
        userMessage = `[Áudio transcrito: ${transcription}] ${userMessage}`.trim();
        // Update DB message with transcription
        const { data: lastMsg } = await supabaseAdmin.from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastMsg) {
          const { error: upErr } = await supabaseAdmin.from("messages").update({ content: userMessage }).eq("id", lastMsg.id);
          if (upErr) console.error("[AI] Error updating transcription in DB:", upErr);
        }
      }
    }

    if (!userMessage && incomingMediaType) {
      userMessage = incomingMediaType === "image" ? "[Imagem]" : "[Áudio]";
    }

    const { data: recentMessages, error: msgErr } = await supabaseAdmin
      .from("messages")
      .select("direction, content")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (msgErr) {
      console.error("[AI] Error fetching message history:", msgErr);
    }

    const chatMessages = (recentMessages || []).reverse().map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: String(m.content),
    }));

    const { data: kbDocs } = await supabaseAdmin.from("kb_documents")
      .select("title, content")
      .eq("tenant_id", tenantId)
      .eq("processing_status", "completed");
    
    let systemPrompt = `Você é um assistente de atendimento inteligente e proativo.\n${aiSettings.general_instructions || ""}\nTom: ${aiSettings.tone}\nResponda sempre em Português do Brasil de forma natural.`;
    if (kbDocs?.length) {
      systemPrompt += `\n\nUSE O CONHECIMENTO ABAIXO PARA RESPONDER (Se a informação não estiver aqui, diga que não sabe ou peça para aguardar um atendente):\n` + 
                      kbDocs.map(d => `--- DOCUMENTO: ${d.title} ---\n${d.content}`).join("\n\n");
    }

    const messages: any[] = [{ role: "system", content: systemPrompt }, ...chatMessages];
    
    // Replace last user message with multimodal content if it's an image
    if (incomingMediaType === "image" && mediaData) {
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "user") {
        messages[lastIdx].content = [
          { type: "text", text: userMessage || "Por favor, descreva ou responda sobre esta imagem." },
          { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.data}` } }
        ];
      }
    }

    console.log(`[AI] Calling OpenAI with model ${aiSettings.openai_model || "gpt-4o"}`);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${aiSettings.openai_api_key}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        model: aiSettings.openai_model || "gpt-4o", 
        messages,
        max_tokens: 1000
      })
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("[AI] OpenAI API Error:", err);
      return;
    }

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (aiContent) {
      console.log("[AI] Response generated successfully.");
      await sendWhatsAppMessage(contactPhone, aiContent, instanceEvolutionId);
      await saveOutboundMessage(tenantId, conversationId, aiContent);
    } else {
      console.warn("[AI] No content returned from OpenAI.");
    }
  } catch (e) {
    console.error("[AI] Critical Error:", e);
  }
}

async function sendWhatsAppMessage(phone: string, text: string, instanceId: string | null) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !instanceId) {
    console.error("[Evolution] Cannot send message: Missing URL, Key or InstanceId");
    return;
  }
  try {
    const url = `${EVOLUTION_API_URL.trim().replace(/\/+$/, "")}/message/sendText/${instanceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY.trim() },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("[Evolution] Send Error:", response.status, err);
    }
  } catch (e) { 
    console.error("[Evolution] Fetch Error during send:", e); 
  }
}

async function saveOutboundMessage(tenantId: string, convId: string, content: string) {
  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: convId,
    tenant_id: tenantId,
    direction: "outbound",
    content,
    is_ai_generated: true,
    sent_at: new Date().toISOString(),
  });
  if (error) console.error("[DB] Error saving outbound message:", error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    const body = await req.json();
    console.log(`[Webhook] Event: ${body.event}, Instance: ${body.instance}`);
    
    const event = body.event?.toLowerCase();
    const instanceName = body.instance;
    const data = body.data;

    if (event === "messages.upsert") {
      const message = data.messages?.[0] || data;
      const phone = (message.key.remoteJid || "").split("@")[0].split(":")[0];
      const fromMe = message.key.fromMe;
      
      console.log(`[Webhook] Message from ${phone}, fromMe: ${fromMe}`);

      // 1. Get Instance
      const { data: instance, error: instErr } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("*")
        .or(`evolution_instance_id.eq.${instanceName},instance_name.eq.${instanceName}`)
        .maybeSingle();

      if (instErr) {
        console.error("[Webhook] DB Error fetching instance:", instErr);
        return new Response("DB Error", { status: 500 });
      }

      if (!instance) {
        console.warn(`[Webhook] Instance ${instanceName} not found in database.`);
        return new Response("Instance not found", { status: 200 });
      }

      const { mediaType, mediaUrl, caption } = extractMessageMedia(message);
      
      // 2. Get/Create Contact
      const { data: contact, error: contErr } = await supabaseAdmin.from("contacts")
        .select("id")
        .eq("tenant_id", instance.tenant_id)
        .eq("phone", phone)
        .maybeSingle();

      if (contErr) console.error("[Webhook] DB Error fetching contact:", contErr);

      let contactId = contact?.id;
      if (!contactId && !fromMe) {
        console.log(`[Webhook] Creating new contact for ${phone}`);
        const { data: newContact, error: createContErr } = await supabaseAdmin.from("contacts")
          .insert({ tenant_id: instance.tenant_id, phone, name: phone })
          .select("id")
          .single();
        
        if (createContErr) {
          console.error("[Webhook] Error creating contact:", createContErr);
        } else {
          contactId = newContact?.id;
        }
      }

      if (!contactId) {
        console.error("[Webhook] Could not resolve contactId.");
        return new Response("Contact error", { status: 200 });
      }

      // 3. Get/Create Conversation
      const { data: conversation, error: convErr } = await supabaseAdmin.from("conversations")
        .select("id, status")
        .eq("contact_id", contactId)
        .eq("instance_id", instance.id)
        .maybeSingle();

      if (convErr) console.error("[Webhook] DB Error fetching conversation:", convErr);

      let convId = conversation?.id;
      if (!convId) {
        console.log(`[Webhook] Creating new conversation for contact ${contactId}`);
        const { data: newConv, error: createConvErr } = await supabaseAdmin.from("conversations")
          .insert({ 
            contact_id: contactId, 
            instance_id: instance.id, 
            tenant_id: instance.tenant_id, 
            status: "open" 
          })
          .select("id")
          .single();
        
        if (createConvErr) {
          console.error("[Webhook] Error creating conversation:", createConvErr);
        } else {
          convId = newConv?.id;
        }
      }

      if (!convId) {
        console.error("[Webhook] Could not resolve convId.");
        return new Response("Conversation error", { status: 200 });
      }

      // 4. Save Message
      const textContent = caption || message.message?.conversation || message.message?.extendedTextMessage?.text || "";
      const displayContent = mediaType ? (textContent || `[${mediaType}]`) : textContent;

      console.log(`[Webhook] Saving message: "${displayContent.substring(0, 50)}..."`);

      const { error: saveErr } = await supabaseAdmin.from("messages").insert({
        conversation_id: convId,
        tenant_id: instance.tenant_id,
        direction: "inbound",
        content: displayContent,
        media_type: mediaType,
        media_url: mediaUrl,
        sent_at: new Date(message.messageTimestamp * 1000).toISOString(),
      });

      if (saveErr) {
        console.error("[Webhook] ERROR SAVING MESSAGE TO DB:", saveErr);
        // If it's a JWT error, log it specifically
        if (saveErr.message.includes("JWT") || saveErr.code === "PGRST301") {
          console.error("[Webhook] AUTHENTICATION FAILURE: The service role key is likely invalid.");
        }
      } else {
        console.log("[Webhook] Message saved successfully.");
      }

      // 5. Trigger AI Response
      if (!fromMe && conversation?.status !== "pending") {
        generateAIResponse(
          instance.tenant_id,
          convId,
          instance.evolution_instance_id,
          phone,
          instance.id,
          mediaType,
          message.key,
          textContent
        ).catch(err => console.error("[Webhook] AI Processing Error:", err));
      }
    }
    
    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (err) {
    console.error("CRITICAL Webhook Error:", err);
    return new Response("Internal Error", { status: 500, headers: corsHeaders });
  }
});

