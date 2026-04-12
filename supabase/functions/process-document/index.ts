import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdf from "npm:pdf-parse@1.1.1";

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

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ success: false, error: "document_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get document metadata
    const { data: doc, error: docError } = await adminClient
      .from("kb_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ success: false, error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to the tenant
    const { data: isMember } = await adminClient.rpc("is_tenant_member", {
      _user_id: user.id,
      _tenant_id: doc.tenant_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user OpenAI settings
    const { data: aiSettings, error: aiSettingsError } = await adminClient
      .from("ai_settings")
      .select("openai_api_key, openai_model")
      .eq("tenant_id", doc.tenant_id)
      .single();

    if (aiSettingsError || !aiSettings?.openai_api_key) {
      console.error("AI Settings error or missing API Key:", aiSettingsError);
      return new Response(JSON.stringify({ success: false, error: "OpenAI API Key não configurada nas configurações de IA" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await adminClient.from("kb_documents").update({ processing_status: "processing" }).eq("id", document_id);

    // Download file from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("knowledge-base")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      await adminClient.from("kb_documents").update({ processing_status: "error" }).eq("id", document_id);
      return new Response(JSON.stringify({ success: false, error: "Failed to download file" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine mime type
    const ext = doc.file_name.split(".").pop()?.toLowerCase() || "";
    const textExts = ["txt", "md", "json", "csv", "xml", "yaml", "yml"];
    const isTextFile = textExts.includes(ext);

    let extractedContent = "";

    if (isTextFile) {
      // Text files: read content directly, no AI needed
      extractedContent = await fileData.text();
    } else if (ext === "pdf") {
      // Extract PDF text locally and natively
      console.log(`Extracting text from PDF locally: ${doc.file_name}`);
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      try {
        console.log("Parsing PDF with pdf-parse...");
        const data = await pdf(bytes);
        
        // Basic normalization: remove multiple spaces, weird characters
        let text = data.text || "";
        text = text.replace(/\s+/g, " ").trim();
        
        extractedContent = text;
        console.log(`PDF text extracted successfully. Length: ${extractedContent.length}`);
        if (extractedContent.length > 0) {
          console.log(`Snippet: ${extractedContent.substring(0, 100)}...`);
        } else {
          console.warn("PDF extraction returned empty text. PDF might be image-only.");
        }
      } catch (pdfError) {
        console.error("Error parsing PDF locally:", pdfError);
        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
        throw new Error(`Falha na extração local do PDF: ${errorMessage}`);
      }
    } else if (["png", "jpg", "jpeg"].includes(ext)) {
      // Binary files (images): use AI extraction
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };
      const mimeType = mimeMap[ext] || "image/jpeg";

      // Call OpenAI to extract text
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiSettings.openai_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiSettings.openai_model || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a document text extractor. Extract ALL text content from the provided document. Return ONLY the extracted text, preserving the original structure (headers, lists, paragraphs). Do not add commentary or explanations. If it's a menu/price list, preserve all items and prices. If it's a FAQ, preserve all questions and answers.",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                {
                  type: "text",
                  text: `Extract all text content from this ${doc.doc_type} document titled "${doc.title}". Return the complete text.`,
                },
              ],
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errText);
        } catch {
          errorData = errText;
        }

        console.error("AI extraction error:", aiResponse.status, errorData);
        await adminClient.from("kb_documents").update({ processing_status: "error" }).eq("id", document_id);

        return new Response(JSON.stringify({ 
          success: false, 
          error: "OpenAI API Error", 
          details: errorData 
        }), {
          status: aiResponse.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const aiData = await aiResponse.json();
      extractedContent = aiData.choices?.[0]?.message?.content || "";
    } else {
      // Fallback or unhandled extension
      await adminClient.from("kb_documents").update({ processing_status: "error" }).eq("id", document_id);
      return new Response(JSON.stringify({ success: false, error: `Tipo de arquivo não suportado para extração automática: .${ext}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save extracted content
    await adminClient.from("kb_documents").update({
      content: extractedContent,
      processing_status: "completed",
    }).eq("id", document_id);

    return new Response(JSON.stringify({ success: true, data: { content_length: extractedContent.length } }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e instanceof Error ? e.message : "Internal error",
      details: e
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
