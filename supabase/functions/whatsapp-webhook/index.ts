import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/+$/, "");
const EVO_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── HELPERS: Variables & Context ──────────────────────────────────────────
async function getContext(contactId: string, tenantId: string, stateVariables: any = {}) {
  const { data: contact } = await db.from("contacts").select("*").eq("id", contactId).single();
  const context = {
    name: contact?.name || "Cliente",
    phone: contact?.phone || "",
    email: contact?.email || "",
    ...contact?.metadata,
    ...stateVariables
  };
  return context;
}

function replaceVariables(text: string, context: any) {
  return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const value = context[key.trim()];
    return value !== undefined ? String(value) : match;
  });
}


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
async function aiRespond(tenantId: string, convId: string, instanceName: string, phone: string, contactId: string) {
  try {
    console.log(`[AI] Starting response for conv=${convId} instance=${instanceName}`);
    const { data: ai } = await db.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    
    if (!ai?.ai_enabled || !ai?.openai_api_key) {
      console.log("[AI] Disabled or no key");
      return;
    }

    // 1. Prepare Context (KB + Services)
    const { data: kbDocs } = await db.from("kb_documents")
      .select("title, content")
      .eq("tenant_id", tenantId)
      .eq("processing_status", "completed")
      .limit(10);

    const { data: services } = await db.from("services")
      .select("name, description, duration_minutes, price_cents")
      .eq("tenant_id", tenantId)
      .eq("active", true);

    let sys = `Você é um assistente de atendimento inteligente.\n${ai.general_instructions || ""}\nTom: ${ai.tone || "Amigável"}\nResponda em Português do Brasil.`;
    
    if (kbDocs?.length) {
      sys += "\n\nCONHECIMENTO BASE:\n" + kbDocs.map((d: any) => `[${d.title}]\n${d.content}`).join("\n\n");
    }

    if (services?.length) {
      sys += "\n\nNOSSOS SERVIÇOS E PREÇOS:\n" + services.map((s: any) => 
        `- ${s.name}: ${s.description || ""} (${s.duration_minutes}min) - R$ ${(s.price_cents / 100).toFixed(2).replace(".", ",")}`
      ).join("\n");
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
            "3. CANCELAMENTO: Se o cliente quiser cancelar um agendamento, use a tag: [CANCEL: YYYY-MM-DD].\n" +
            "4. DADOS: Se o cliente informar CPF, E-mail ou Nome, use a tag: [DATA: cpf=... | email=... | name=...]. Use esta tag IMEDIATAMENTE após receber a informação.\n" +
            "5. ANÁLISE:\n" +
            "- Se o cliente agradecer ou estiver feliz: [ANALYSIS: satisfeito | Cliente agradeceu o atendimento]\n" +
            "- Se o cliente estiver reclamando: [ANALYSIS: irritado | Cliente demonstrou insatisfação]\n" +
            "- Se for uma conversa normal: [ANALYSIS: neutro | Conversa em andamento sobre X]\n" +
            "- Se ele só tiver perguntas: [ANALYSIS: dúvida | Cliente buscando informações sobre Y]\n" +
            "Responda sempre em Português de forma natural e empática."
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
    // a) Analysis
    const analysisMatch = reply.match(/\[ANALYSIS: (.*?) \| (.*?)\]/);
    if (analysisMatch) {
      const sentiment = analysisMatch[1].trim().toLowerCase();
      const summary = analysisMatch[2].trim();
      await db.from("conversations").update({
        sentiment: sentiment,
        summary: summary,
        last_analysis_at: new Date().toISOString()
      }).eq("id", convId);
      reply = reply.replace(analysisMatch[0], "").trim();
    }

    // b) Transfer
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

          // Fix Timezone: Ensure we treat the date as America/Sao_Paulo
          // The dateTime from GPT is usually "YYYY-MM-DD HH:mm:ss"
          const isoWithTimezone = dateTime.includes("T") ? dateTime : `${dateTime.replace(" ", "T")}-03:00`;
          const finalDate = new Date(isoWithTimezone).toISOString();

          // 2. Check if there's already a pending/confirmed schedule for this contact
          const { data: existingSched } = await db.from("schedules")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("contact_id", conv?.contact_id)
            .in("status", ["pending", "confirmed"])
            .gte("scheduled_at", new Date().toISOString()) // Only future ones
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existingSched) {
            console.log(`[AI] Updating existing schedule ${existingSched.id}`);
            const { error: updErr } = await db.from("schedules").update({
              title: `${title} (${phone})`,
              scheduled_at: finalDate,
              duration_minutes: parseInt(duration) || 30,
              description: `Remarcado automaticamente pela IA - Telefone: ${phone}`
            }).eq("id", existingSched.id);
            
            if (updErr) throw updErr;
          } else {
            // Insert the schedule
            const { error: schedErr } = await db.from("schedules").insert({
              tenant_id: tenantId,
              contact_id: conv?.contact_id,
              title: `${title} (${phone})`,
              scheduled_at: finalDate,
              duration_minutes: parseInt(duration) || 30,
              status: "pending",
              created_by: admin.user_id,
              description: `Agendado automaticamente pela IA - Telefone: ${phone}`
            });
            if (schedErr) throw schedErr;
          }
          console.log("[AI] Schedule operation successful");
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

    // d) Cancel
    if (reply.includes("[CANCEL:")) {
      const match = reply.match(/\[CANCEL:\s*(.*?)\s*\]/);
      if (match) {
        const [fullTag, dateStr] = match;
        reply = reply.replace(fullTag, "").trim();
        
        try {
          console.log(`[AI] Cancelling schedules for date: ${dateStr}`);
          const { data: conv } = await db.from("conversations").select("contact_id").eq("id", convId).single();
          
          // Delete pending schedules for this contact on that day
          const { error: delErr } = await db.from("schedules")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("contact_id", conv?.contact_id)
            .eq("status", "pending")
            .filter("scheduled_at", "gte", `${dateStr}T00:00:00-03:00`)
            .filter("scheduled_at", "lte", `${dateStr}T23:59:59-03:00`);

          if (delErr) throw delErr;
          console.log("[AI] Cancellation/Cleanup successful");
        } catch (err: any) {
          console.error("[AI] Cancel Exception:", err);
        }
      }
    }

    // d) Data Extraction (CPF, Email, Name)
    if (reply.includes("[DATA:")) {
      const match = reply.match(/\[DATA:\s*(.*?)\s*\]/);
      if (match) {
        const [fullTag, dataStr] = match;
        reply = reply.replace(fullTag, "").trim();
        
        const updates: any = {};
        if (dataStr.includes("cpf=")) {
          updates.cpf = dataStr.match(/cpf=(.*?)(?:\s*\||$)/)?.[1]?.trim();
        }
        if (dataStr.includes("email=")) {
          updates.email = dataStr.match(/email=(.*?)(?:\s*\||$)/)?.[1]?.trim();
        }
        if (dataStr.includes("name=")) {
          updates.name = dataStr.match(/name=(.*?)(?:\s*\||$)/)?.[1]?.trim();
        }

        if (Object.keys(updates).length > 0) {
          console.log(`[AI] Updating contact data:`, updates);
          const { data: conv } = await db.from("conversations").select("contact_id").eq("id", convId).single();
          if (conv?.contact_id) {
            await db.from("contacts").update(updates).eq("id", conv.contact_id);
          }
        }
      }
    }

    // 5. Send Response (Text or Voice)
    const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
    
    // Replace variables in AI reply if any (IA can generate {{name}} too)
    const context = await getContext(contactId, tenantId);
    reply = replaceVariables(reply, context);

    if (ai.voice_enabled && reply.length < 1000) {
      try {
        console.log(`[AI] Generating voice response with voice: ${ai.voice_id}...`);
        const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ai.openai_api_key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: ai.voice_model || "tts-1",
            input: reply,
            voice: ai.voice_id || "alloy",
            response_format: "mp3"
          })
        });

        if (ttsRes.ok) {
          const audioBlob = await ttsRes.blob();
          console.log("[AI] Uploading generated voice to Supabase Storage...");
          const fileName = `ai_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
           const filePath = `${tenantId}/${fileName}`;
           const arrayBuffer = await audioBlob.arrayBuffer();
           const { error: uploadError } = await db.storage.from("whatsapp-media").upload(filePath, arrayBuffer, { contentType: "audio/mpeg", upsert: false });
          
          if (uploadError) {
            console.error("[AI] Failed to upload audio:", JSON.stringify(uploadError));
            throw new Error(`Upload falhou: ${uploadError.message || JSON.stringify(uploadError)}`);
          }
          const { data: urlData } = db.storage.from("whatsapp-media").getPublicUrl(filePath);
          const audioUrl = urlData.publicUrl;

          console.log("[AI] Sending voice response to Evolution API via sendMedia using URL:", audioUrl);
          const evoRes = await fetch(`${EVO_URL}/message/sendMedia/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": EVO_KEY },
            body: JSON.stringify({
              number: remoteJid,
              media: audioUrl,
              mediatype: "audio",
              options: { ptt: true },
              delay: 1000,
              encoding: true
            })
          });

          if (!evoRes.ok) {
             const evoErrText = await evoRes.text();
             console.error("[AI] Evolution API Audio Send Error:", evoRes.status, evoErrText);
             await db.from("messages").insert({
               conversation_id: convId, tenant_id: tenantId, direction: "outbound",
               content: `⚠️ Erro EvoAPI (${evoRes.status}): ${evoErrText.substring(0,100)}`, is_ai_generated: true, sent_at: new Date().toISOString()
             });
             throw new Error(`Evo API failed with status ${evoRes.status}`);
          }

          await db.from("messages").insert({
            conversation_id: convId, tenant_id: tenantId, direction: "outbound",
            content: `🎤 "${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}"`,
            media_type: "audio",
            media_url: audioUrl,
            is_ai_generated: true, sent_at: new Date().toISOString()
          });
        } else {
          console.error("[AI] TTS Error, falling back to text");
          await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, reply);
          await db.from("messages").insert({
            conversation_id: convId, tenant_id: tenantId, direction: "outbound",
            content: reply, is_ai_generated: true, sent_at: new Date().toISOString()
          });
        }
      } catch (ttsErr: any) {
        console.error("[AI] Voice Exception:", ttsErr);
        await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, reply);
        await db.from("messages").insert({
          conversation_id: convId, tenant_id: tenantId, direction: "outbound",
          content: reply, is_ai_generated: true, sent_at: new Date().toISOString()
        });
        await db.from("messages").insert({
          conversation_id: convId, tenant_id: tenantId, direction: "outbound",
          content: `⚠️ Erro de Exceção TTS: ${ttsErr.message || String(ttsErr)}`, is_ai_generated: true, sent_at: new Date().toISOString()
        });
      }
    } else {
      // Send Text
      await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, reply);
      await db.from("messages").insert({
        conversation_id: convId, tenant_id: tenantId, direction: "outbound",
        content: reply, is_ai_generated: true, sent_at: new Date().toISOString()
      });
    }

    console.log("[AI] Success. Reply sent to", phone);

  } catch (e: any) {
    console.error("[AI] Fatal Exception:", e);
    await db.from("messages").insert({
      conversation_id: convId, tenant_id: tenantId, direction: "outbound",
      content: `⚠️ Erro Fatal na IA: ${e.message}`,
      is_ai_generated: false
    });
  }
}

/**
 * Executes a specific node in an automation flow
 */
async function executeNode(node: any, flow: any, contactId: string, tenantId: string, instanceName: string, phone: string, convId: string, variables: any = {}) {
  const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  console.log(`[Flow] Executing node=${node.id} type=${node.type} for contact=${contactId}`);

  const context = await getContext(contactId, tenantId, variables);

  if (node.type === 'message') {
    let text = node.data?.text || "Sem conteúdo";
    text = replaceVariables(text, context);
    
    await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, text);
    
    // Save to DB
    await db.from("messages").insert({
      conversation_id: convId, tenant_id: tenantId, direction: "outbound",
      content: text, is_ai_generated: false, sent_at: new Date().toISOString()
    });

    // If node is configured to wait for response, stop here
    if (node.data?.wait_for_response) {
      await db.from("automation_states").upsert({
        contact_id: contactId, tenant_id: tenantId, flow_id: flow.id,
        current_node_id: node.id, variables: variables, last_interaction_at: new Date().toISOString()
      }, { onConflict: 'contact_id' });
      return;
    }

    // Update state to current node
    await db.from("automation_states").upsert({
      contact_id: contactId, tenant_id: tenantId, flow_id: flow.id,
      current_node_id: node.id, variables: variables, last_interaction_at: new Date().toISOString()
    }, { onConflict: 'contact_id' });

    // Chain to next node if connected
    const edge = flow.edges?.find((e: any) => e.source === node.id);
    if (edge) {
      const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
      if (nextNode) {
        await new Promise(r => setTimeout(r, 800));
        await executeNode(nextNode, flow, contactId, tenantId, instanceName, phone, convId, variables);
      }
    } else {
      // End of flow
      await db.from("automation_states").delete().eq("contact_id", contactId);
    }

  } else if (node.type === 'menu') {
    let title = node.data?.title || "Escolha uma opção:";
    title = replaceVariables(title, context);
    
    const options = node.data?.options || [];
    let menuText = `*${title}*\n\n`;
    options.forEach((opt: string, idx: number) => {
      menuText += `${idx + 1}. ${opt}\n`;
    });

    await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, menuText);

    // Save to DB
    await db.from("messages").insert({
      conversation_id: convId, tenant_id: tenantId, direction: "outbound",
      content: menuText, is_ai_generated: false, sent_at: new Date().toISOString()
    });

    // Update state
    await db.from("automation_states").upsert({
      contact_id: contactId, tenant_id: tenantId, flow_id: flow.id,
      current_node_id: node.id, variables: variables, last_interaction_at: new Date().toISOString()
    }, { onConflict: 'contact_id' });

  } else if (node.type === 'condition') {
    const { variable, operator, value } = node.data || {};
    const actualValue = context[variable];
    let result = false;

    if (operator === 'equals') result = String(actualValue) === String(value);
    else if (operator === 'contains') result = String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    else if (operator === 'not_equals') result = String(actualValue) !== String(value);
    else if (operator === 'greater_than') result = Number(actualValue) > Number(value);
    else if (operator === 'less_than') result = Number(actualValue) < Number(value);

    const handle = result ? 'true' : 'false';
    const edge = flow.edges?.find((e: any) => e.source === node.id && e.sourceHandle === handle);
    
    if (edge) {
      const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
      if (nextNode) {
        await executeNode(nextNode, flow, contactId, tenantId, instanceName, phone, convId, variables);
      }
    } else {
      await db.from("automation_states").delete().eq("contact_id", contactId);
    }

  } else if (node.type === 'http_request') {
    const { url, method = 'GET', body, variable_name } = node.data || {};
    try {
      const parsedUrl = replaceVariables(url, context);
      const res = await fetch(parsedUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'GET' ? replaceVariables(body || '{}', context) : undefined
      });
      
      if (res.ok && variable_name) {
        const data = await res.json();
        variables[variable_name] = data;
      }
    } catch (e) {
      console.error("[Flow] HTTP Request Error:", e);
    }

    const edge = flow.edges?.find((e: any) => e.source === node.id);
    if (edge) {
      const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
      if (nextNode) {
        await executeNode(nextNode, flow, contactId, tenantId, instanceName, phone, convId, variables);
      }
    } else {
      await db.from("automation_states").delete().eq("contact_id", contactId);
    }

  } else if (node.type === 'action') {
    const action = node.data?.action || "ai_handover";
    
    if (action === 'human_transfer') {
      await db.from("conversations").update({ status: "pending" }).eq("id", convId);
      await db.from("automation_states").delete().eq("contact_id", contactId);
      const transferMsg = "Aguarde um momento, vou transferir você para um atendente humano. 👤";
      await sendEvolutionMessage(EVO_URL, EVO_KEY, instanceName, remoteJid, transferMsg);
      
      // Save transfer message to DB
      await db.from("messages").insert({
        conversation_id: convId,
        tenant_id: tenantId,
        direction: "outbound",
        content: transferMsg,
        is_ai_generated: false,
        sent_at: new Date().toISOString()
      });
    } else if (action === 'add_tag') {
      const tagName = node.data?.tag_name;
      if (tagName) {
        const { data: contact } = await db.from("contacts").select("tags").eq("id", contactId).single();
        const currentTags = contact?.tags ? contact.tags.split(",").map((t: string) => t.trim()) : [];
        if (!currentTags.includes(tagName)) {
          currentTags.push(tagName);
          await db.from("contacts").update({ tags: currentTags.join(", ") }).eq("id", contactId);
        }
      }
      const edge = flow.edges?.find((e: any) => e.source === node.id);
      if (edge) {
        const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
        if (nextNode) await executeNode(nextNode, flow, contactId, tenantId, instanceName, phone, convId, variables);
      } else {
        await db.from("automation_states").delete().eq("contact_id", contactId);
      }
    } else if (action === 'ai_handover') {
      await db.from("automation_states").delete().eq("contact_id", contactId);
    }
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
    let { data: conv } = await db.from("conversations").select("id, status, last_message_at").eq("contact_id", contact.id).eq("instance_id", inst.id).maybeSingle();
    let isNewConv = false;
    
    if (conv) {
      const lastMsg = new Date(conv.last_message_at || 0).getTime();
      const hoursSinceLast = (Date.now() - lastMsg) / (1000 * 60 * 60);
      if (conv.status === "closed" || hoursSinceLast > 48) {
        isNewConv = true;
        // Reactivate conversation if it was closed
        if (conv.status === "closed") {
          await db.from("conversations").update({ status: "open" }).eq("id", conv.id);
        }
      }
    } else {
      const { data: nc } = await db.from("conversations").insert({ contact_id: contact.id, instance_id: inst.id, tenant_id: inst.tenant_id, status: "open" }).select("id, status").single();
      conv = nc;
      isNewConv = true;
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

    // ── Node 6b: Auto-Confirm Schedule ──────────────────────────────────────
    if (!fromMe && finalContent) {
      const upper = finalContent.toUpperCase().trim().replace(/[.,!]/g, "");
      if (["SIM", "CONFIRMO", "CONFIRMAR", "OK", "ESTA OK", "ESTÁ OK", "AGENDADO"].includes(upper)) {
        console.log(`[N6b] Potential confirmation from ${phone}`);
        // Find closest pending schedule for this contact
        const { data: sched } = await db.from("schedules")
          .select("id, title")
          .eq("contact_id", contact.id)
          .eq("status", "pending")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();
          
        if (sched) {
          console.log(`[N6b] Auto-confirming schedule ${sched.id}: ${sched.title}`);
          await db.from("schedules").update({ status: "confirmed" }).eq("id", sched.id);
        }
      }
    }

    // ── Node 7: AUTOMATION FLOWS (New) ──────────────────
    let flowHandled = false;
    if (!fromMe && conv.status !== "pending") {
      try {
        console.log(`[Flow] Checking for active flows for contact=${contact.id}`);
        
        // 1. Check for active state
        const { data: state } = await db.from("automation_states")
          .select("*")
          .eq("contact_id", contact.id)
          .maybeSingle();

        if (state) {
          const lastInteraction = new Date(state.last_interaction_at || 0).getTime();
          const now = Date.now();
          const hoursInactive = (now - lastInteraction) / (1000 * 60 * 60);

          if (hoursInactive > 24) {
            console.log(`[Flow] State expired for contact=${contact.id}. Deleting.`);
            await db.from("automation_states").delete().eq("contact_id", contact.id);
            // After deleting, continue to trigger check
          } else {
            console.log(`[Flow] Contact in active flow=${state.flow_id} at node=${state.current_node_id}`);
          // Logic to process next node based on input
          const { data: flow } = await db.from("automation_flows").select("*").eq("id", state.flow_id).single();
          if (flow && flow.is_active) {
            const currentNode = flow.nodes?.find((n: any) => n.id === state.current_node_id);
            const currentVariables = state.variables || {};

            if (currentNode?.type === 'menu') {
              // Match input to menu options
              const input = finalContent.trim();
              const options = currentNode.data?.options || [];
              const optionIndex = options.findIndex((opt: string, idx: number) => 
                input === String(idx + 1) || input.toLowerCase() === opt.toLowerCase()
              );

              if (optionIndex !== -1) {
                // Find next node via edges
                const edge = flow.edges?.find((e: any) => e.source === currentNode.id && e.sourceHandle === `option-${optionIndex}`);
                if (edge) {
                  const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
                  if (nextNode) {
                    await executeNode(nextNode, flow, contact.id, inst.tenant_id, instanceName, phone, conv.id, currentVariables);
                    flowHandled = true;
                  }
                }
              }
            } else if (currentNode?.type === 'message' && currentNode.data?.wait_for_response) {
              // Capture input to variables
              const varName = currentNode.data?.variable_name;
              if (varName) {
                currentVariables[varName] = finalContent;
              }
              
              // Find next node
              const edge = flow.edges?.find((e: any) => e.source === currentNode.id);
              if (edge) {
                const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
                if (nextNode) {
                  await executeNode(nextNode, flow, contact.id, inst.tenant_id, instanceName, phone, conv.id, currentVariables);
                  flowHandled = true;
                }
              }
            } else {
              // For other nodes, maybe just look for a direct connection (simple branching)
              const edge = flow.edges?.find((e: any) => e.source === currentNode.id);
              if (edge) {
                const nextNode = flow.nodes?.find((n: any) => n.id === edge.target);
                if (nextNode) {
                  await executeNode(nextNode, flow, contact.id, inst.tenant_id, instanceName, phone, conv.id, currentVariables);
                  flowHandled = true;
                }
              }
            }
          }
          
          if (!flowHandled) {
             // If no match in menu, we can either repeat menu or handover to AI
             // For now, let's just clear state and let AI handle it
             await db.from("automation_states").delete().eq("contact_id", contact.id);
          }
        }
      } else {
          // 2. Check for triggers
          const { data: activeFlows } = await db.from("automation_flows")
            .select("*")
            .eq("tenant_id", inst.tenant_id)
            .eq("is_active", true);

          const matchedFlow = activeFlows?.find(f => {
            if (isNewConv && f.trigger_type === 'welcome') {
              return true;
            }
            if (f.trigger_type === 'keyword' && f.trigger_value) {
              return finalContent.toLowerCase().includes(f.trigger_value.toLowerCase());
            }
            return false;
          });

          if (matchedFlow) {
            console.log(`[Flow] Trigger matched! Starting flow=${matchedFlow.id}`);
            // Find start node (usually the one with no incoming edges or a specific start type)
            // For now, let's take the first node that is NOT an action node if multiple exist
            const startNode = matchedFlow.nodes?.find((n: any) => n.type !== 'action') || matchedFlow.nodes?.[0];
            if (startNode) {
              await executeNode(startNode, matchedFlow, contact.id, inst.tenant_id, instanceName, phone, conv.id);
              flowHandled = true;
            }
          }
        }
      } catch (e) {
        console.error("[Flow] Error:", e);
      }
    }

    if (!fromMe && conv.status !== "pending" && !flowHandled) {
      // Use instanceName ("bot") NOT the UUID
      aiRespond(inst.tenant_id, conv.id, instanceName, phone, contact.id)
        .catch(e => console.error("[N8] AI error:", e));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[Webhook] Critical:", err);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});

/**
 * Helper to send text messages via Evolution API
 */
async function sendEvolutionMessage(url: string, key: string, instance: string, number: string, text: string) {
  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({
        number: number,
        text: text,
        options: { delay: 1200, presence: "composing" }
      })
    });
    if (!res.ok) {
      console.error("[Evolution] Send failed:", await res.text());
    }
  } catch (e) {
    console.error("[Evolution] Exception:", e);
  }
}
