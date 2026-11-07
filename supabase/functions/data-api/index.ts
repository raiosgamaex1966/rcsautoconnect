import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId = req.headers.get("x-supabase-user-id");
    
    // Robustness fallback: If x-supabase-user-id is missing, try to get it from the JWT
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const payloadBase64 = token.split(".")[1];
          const payload = JSON.parse(atob(payloadBase64));
          userId = payload.sub;
          console.log("Extracted userId from JWT fallback:", userId);
        } catch (e) {
          console.error("Failed to extract userId from JWT:", e);
        }
      }
    }

    if (!userId) {
      console.error("No userId found in headers or JWT. Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }


    const user = { id: userId };
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const action = body._action;
    if (!action) return jsonResponse({ success: false, error: "Missing _action" }, 400);


    // Helper: get tenant
    const getTenant = async () => {
      const { data: tenantId } = await adminClient.rpc("get_user_tenant_id", { _user_id: user.id });
      return tenantId;
    };

    // Helper: verify tenant membership
    const verifyTenant = async () => {
      const tenantId = await getTenant();
      if (!tenantId) {
        return { tenantId: null, error: jsonResponse({ success: false, error: "No tenant found" }, 400) };
      }
      const { data: isMember } = await adminClient.rpc("is_tenant_member", { _user_id: user.id, _tenant_id: tenantId });
      if (!isMember) {
        // Fallback for admins: let them view even if not explicit member
        if (await checkAdmin()) return { tenantId, error: null };
        return { tenantId: null, error: jsonResponse({ success: false, error: "Forbidden" }, 403) };
      }
      return { tenantId, error: null };
    };

    // Helper: check admin
    const checkAdmin = async () => {
      const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!isAdmin;
    };

    // ═══════════════════════════════════════════
    // CONTACTS
    // ═══════════════════════════════════════════

    if (action === "contacts-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient
        .from("contacts").select("*").eq("tenant_id", tenantId).order("name", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "contacts-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { name, phone, email, cpf, tags, notes } = body;
      if (!name || !phone) return jsonResponse({ success: false, error: "name and phone required" }, 400);
      const { data, error: dbErr } = await adminClient.from("contacts").insert({
        tenant_id: tenantId, name: String(name).trim(), phone: String(phone).trim(),
        email: email || null, cpf: cpf || null, tags: tags || [], notes: notes || null,
      }).select().single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "contacts-update") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, updates } = body;
      if (!id || !updates) return jsonResponse({ success: false, error: "id and updates required" }, 400);
      const allowed = ["name", "phone", "email", "cpf", "tags", "notes"];
      const sanitized: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) sanitized[k] = updates[k]; }
      const { error: dbErr } = await adminClient.from("contacts").update(sanitized).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "contacts-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("contacts").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "contacts-bulk-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { rows } = body;
      if (!rows || !Array.isArray(rows)) return jsonResponse({ success: false, error: "rows array required" }, 400);
      const BATCH = 500;
      let imported = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map((r: any) => ({
          tenant_id: tenantId, name: String(r.name || "").trim(), phone: String(r.phone || "").trim(),
          email: r.email || null, cpf: r.cpf || null, tags: r.tags || [],
        }));
        const { error: dbErr } = await adminClient.from("contacts").insert(batch);
        if (dbErr) return jsonResponse({ success: false, error: dbErr.message, data: { imported } }, 500);
        imported += batch.length;
      }
      return jsonResponse({ success: true, data: { imported } });
    }

    if (action === "contacts-start-conversation") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { contact_id, instance_id } = body;
      if (!contact_id || !instance_id) return jsonResponse({ success: false, error: "contact_id and instance_id required" }, 400);
      const { data: existing } = await adminClient.from("conversations").select("id")
        .eq("contact_id", contact_id).eq("instance_id", instance_id).eq("tenant_id", tenantId).maybeSingle();
      if (existing) return jsonResponse({ success: true, data: { id: existing.id } });
      const { data, error: dbErr } = await adminClient.from("conversations").insert({
        contact_id, instance_id, tenant_id: tenantId, status: "open", unread_count: 0,
      }).select("id").single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data: { id: data.id } });
    }

    if (action === "contacts-get-conversation") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { contact_id } = body;
      if (!contact_id) return jsonResponse({ success: false, error: "contact_id required" }, 400);
      const { data } = await adminClient.from("conversations").select("id")
        .eq("contact_id", contact_id).eq("tenant_id", tenantId)
        .order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      return jsonResponse({ success: true, data: { id: data?.id || null } });
    }

    // ═══════════════════════════════════════════
    // SCHEDULES
    // ═══════════════════════════════════════════

    if (action === "schedules-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("schedules")
        .select("*, contact:contacts(name, phone, email, cpf)").eq("tenant_id", tenantId)
        .order("scheduled_at", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "schedules-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { title, description, scheduled_at, duration_minutes, contact_id } = body;
      if (!title || !scheduled_at) return jsonResponse({ success: false, error: "title and scheduled_at required" }, 400);
      const { data, error: dbErr } = await adminClient.from("schedules").insert({
        tenant_id: tenantId, created_by: user.id, title: String(title).trim(),
        description: description || null, scheduled_at, duration_minutes: duration_minutes || 30,
        contact_id: contact_id || null,
      }).select().single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "schedules-update-status") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, status } = body;
      if (!id || !status) return jsonResponse({ success: false, error: "id and status required" }, 400);
      const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
      if (!validStatuses.includes(status)) return jsonResponse({ success: false, error: "Invalid status" }, 400);
      const { error: dbErr } = await adminClient.from("schedules").update({ status }).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "schedules-update") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, title, description, scheduled_at, duration_minutes, contact_id, status } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = String(title).trim();
      if (description !== undefined) updateData.description = description || null;
      if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at;
      if (duration_minutes !== undefined) updateData.duration_minutes = parseInt(duration_minutes) || 30;
      if (contact_id !== undefined) updateData.contact_id = contact_id || null;
      if (status !== undefined) {
        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (!validStatuses.includes(status)) return jsonResponse({ success: false, error: "Invalid status" }, 400);
        updateData.status = status;
      }
      if (Object.keys(updateData).length === 0) return jsonResponse({ success: false, error: "No fields to update" }, 400);
      const { data, error: dbErr } = await adminClient.from("schedules").update(updateData).eq("id", id).eq("tenant_id", tenantId).select().single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "schedules-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("schedules").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // KB DOCUMENTS
    // ═══════════════════════════════════════════

    if (action === "kb-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("kb_documents").select("*")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "kb-insert") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { title, doc_type, file_name, file_path, file_size_bytes } = body;
      if (!title || !file_name || !file_path) return jsonResponse({ success: false, error: "title, file_name, file_path required" }, 400);
      const { data, error: dbErr } = await adminClient.from("kb_documents").insert({
        tenant_id: tenantId, title: String(title).trim(), doc_type: doc_type || "outro",
        file_name, file_path, file_size_bytes: file_size_bytes || 0, processing_status: "pending",
      }).select("id").single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "kb-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { data: doc } = await adminClient.from("kb_documents").select("file_path").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
      if (!doc) return jsonResponse({ success: false, error: "Document not found" }, 404);
      await adminClient.storage.from("knowledge-base").remove([doc.file_path]);
      const { error: dbErr } = await adminClient.from("kb_documents").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "kb-reprocess") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("kb_documents").update({ processing_status: "pending" }).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // PLANS (Admin only)
    // ═══════════════════════════════════════════

    if (action === "plans-list") {
      const { data, error: dbErr } = await adminClient.from("plans").select("*").order("price_cents", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "plans-create") {
      if (!(await checkAdmin())) return jsonResponse({ success: false, error: "Forbidden" }, 403);
      const { name, price_cents, max_messages, max_instances, storage_mb, support_level, trial_days } = body;
      const { data, error: dbErr } = await adminClient.from("plans").insert({
        name: name || "Novo Plano", price_cents: price_cents ?? 0, max_messages: max_messages ?? 100,
        max_instances: max_instances ?? 1, max_users: 1, max_bots: 1, storage_mb: storage_mb ?? 500,
        support_level: support_level || "email", trial_days: trial_days ?? 7, active: false,
      }).select().single();
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "plans-update") {
      if (!(await checkAdmin())) return jsonResponse({ success: false, error: "Forbidden" }, 403);
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const allowed = ["name", "price_cents", "max_messages", "max_instances", "max_users", "max_bots", "storage_mb", "support_level", "trial_days", "active", "checkout_url"];
      const sanitized: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) sanitized[k] = updates[k]; }
      const { error: dbErr } = await adminClient.from("plans").update(sanitized).eq("id", id);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "plans-delete") {
      if (!(await checkAdmin())) return jsonResponse({ success: false, error: "Forbidden" }, 403);
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("plans").delete().eq("id", id);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // AI SETTINGS
    // ═══════════════════════════════════════════

    if (action === "ai-settings-get") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data } = await adminClient.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
      // Mask the API key — only show last 4 chars to non-admin members
      if (data?.openai_api_key) {
        const key = data.openai_api_key;
        data.openai_api_key = key.length > 4 ? "sk-..." + key.slice(-4) : "****";
      }
      return jsonResponse({ success: true, data, tenant_id: tenantId });
    }

    if (action === "ai-settings-upsert") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const allowed = ["ai_enabled", "focus_mode", "tone", "general_instructions", "formatting_style", "greeting", "farewell", "forbidden_responses", "human_trigger_words", "business_type", "business_hours", "openai_api_key", "openai_model", "image_understanding_enabled", "audio_transcription_enabled", "voice_enabled", "voice_id", "voice_model"];
      const sanitized: Record<string, unknown> = { tenant_id: tenantId };
      for (const k of allowed) { if (body[k] !== undefined) sanitized[k] = body[k]; }
      // Don't overwrite API key with masked value
      if (typeof sanitized.openai_api_key === "string" && (sanitized.openai_api_key as string).startsWith("sk-...")) {
        delete sanitized.openai_api_key;
      }
      const { error: dbErr } = await adminClient.from("ai_settings").upsert(sanitized, { onConflict: "tenant_id" });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "ai-usage-get") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;

      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = startOfMonth.toISOString();

        // Count AI-generated messages this month
        const { count, error: countErr } = await adminClient
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("is_ai_generated", true)
          .gte("sent_at", monthStartStr);

        if (countErr) throw countErr;

        // Estimate: average 400 tokens per message (input + output)
        // Pricing for gpt-4o-mini is $0.15 / 1M input, $0.60 / 1M output
        // We'll use a conservative average of $0.0005 per message (approx 1000 tokens of mixed mini/gpt-4o)
        const totalCost = (count || 0) * 0.0005;

        return jsonResponse({ 
          success: true, 
          data: { 
            estimated_usd: totalCost,
            source: "estimated",
            period: "month",
            count: count || 0
          } 
        });
      } catch (e) {
        console.error("[Usage] Error:", e);
        return jsonResponse({ success: false, error: String(e) }, 500);
      }
    }

    // ═══════════════════════════════════════════
    // CONVERSATIONS
    // ═══════════════════════════════════════════

    if (action === "conversations-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("conversations")
        .select("*, contact:contacts(*)").eq("tenant_id", tenantId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "conversations-mark-read") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("conversations").update({ unread_count: 0 }).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "conversations-update-status") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, status } = body;
      if (!id || !status) return jsonResponse({ success: false, error: "id and status required" }, 400);
      const validStatuses = ["open", "closed", "pending"];
      if (!validStatuses.includes(status)) return jsonResponse({ success: false, error: "Invalid status" }, 400);
      const { error: dbErr } = await adminClient.from("conversations").update({ status }).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "conversations-update-kanban") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, kanban_column_id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("conversations").update({ kanban_column_id: kanban_column_id || null }).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // MESSAGES
    // ═══════════════════════════════════════════

    if (action === "messages-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { conversation_id } = body;
      if (!conversation_id) return jsonResponse({ success: false, error: "conversation_id required" }, 400);
      const { data, error: dbErr } = await adminClient.from("messages").select("*")
        .eq("conversation_id", conversation_id).eq("tenant_id", tenantId)
        .order("sent_at", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    // ═══════════════════════════════════════════
    // SERVICES
    // ═══════════════════════════════════════════

    if (action === "services-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("services").select("*")
        .eq("tenant_id", tenantId).order("created_at", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "services-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { name, description, duration_minutes, price_cents, active } = body;
      if (!name) return jsonResponse({ success: false, error: "name required" }, 400);
      const { error: dbErr } = await adminClient.from("services").insert({
        tenant_id: tenantId, name, description: description || "", duration_minutes: duration_minutes || 30,
        price_cents: price_cents || 0, active: active !== false,
      });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "services-update") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const allowed = ["name", "description", "duration_minutes", "price_cents", "active"];
      const sanitized: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) sanitized[k] = updates[k]; }
      const { error: dbErr } = await adminClient.from("services").update(sanitized).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "services-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("services").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // BUSINESS HOURS
    // ═══════════════════════════════════════════

    if (action === "business-hours-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("business_hours").select("*")
        .eq("tenant_id", tenantId).order("day_of_week", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data, tenant_id: tenantId });
    }

    if (action === "business-hours-upsert") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { rows } = body;
      if (!rows || !Array.isArray(rows)) return jsonResponse({ success: false, error: "rows required" }, 400);
      const payload = rows.map((h: any) => ({
        tenant_id: tenantId, day_of_week: h.day_of_week, enabled: h.enabled,
        open_time: h.open_time, close_time: h.close_time,
        break_start: h.break_start, break_end: h.break_end, interval_label: h.interval_label,
      }));
      const { error: dbErr } = await adminClient.from("business_hours").upsert(payload, { onConflict: "tenant_id,day_of_week" });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // BLOCKED DATES
    // ═══════════════════════════════════════════

    if (action === "blocked-dates-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("blocked_dates").select("*")
        .eq("tenant_id", tenantId).order("blocked_date", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "blocked-dates-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { blocked_date, reason } = body;
      if (!blocked_date) return jsonResponse({ success: false, error: "blocked_date required" }, 400);
      const { error: dbErr } = await adminClient.from("blocked_dates").insert({ tenant_id: tenantId, blocked_date, reason: reason || "" });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "blocked-dates-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("blocked_dates").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // REMINDERS
    // ═══════════════════════════════════════════

    if (action === "reminders-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("reminders").select("*")
        .eq("tenant_id", tenantId).order("offset_minutes", { ascending: false });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data, tenant_id: tenantId });
    }

    if (action === "reminders-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { reminder_key, title, description, enabled, message, offset_minutes } = body;
      if (!reminder_key || !title) return jsonResponse({ success: false, error: "reminder_key and title required" }, 400);
      const { error: dbErr } = await adminClient.from("reminders").insert({
        tenant_id: tenantId, reminder_key, title, description: description || "",
        enabled: enabled || false, message: message || "", offset_minutes: offset_minutes || 60,
      });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "reminders-update") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const allowed = ["title", "description", "enabled", "message", "offset_minutes"];
      const sanitized: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) sanitized[k] = updates[k]; }
      const { error: dbErr } = await adminClient.from("reminders").update(sanitized).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "reminders-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const { error: dbErr } = await adminClient.from("reminders").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // REMINDER LOGS
    // ═══════════════════════════════════════════

    if (action === "reminder-logs-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("reminder_logs")
        .select("*, schedule:schedules(title, scheduled_at, contact:contacts(name, phone))")
        .eq("tenant_id", tenantId).order("sent_at", { ascending: false }).limit(50);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    // ═══════════════════════════════════════════
    // KANBAN
    // ═══════════════════════════════════════════

    if (action === "kanban-columns-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("kanban_columns").select("*")
        .eq("tenant_id", tenantId).order("sort_order", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data, tenant_id: tenantId });
    }

    if (action === "kanban-columns-create") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { name, color, sort_order } = body;
      if (!name) return jsonResponse({ success: false, error: "name required" }, 400);
      const { error: dbErr } = await adminClient.from("kanban_columns").insert({
        tenant_id: tenantId, name, color: color || "#6366f1", sort_order: sort_order ?? 0,
      });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "kanban-columns-update") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      const allowed = ["name", "color", "sort_order"];
      const sanitized: Record<string, unknown> = {};
      for (const k of allowed) { if (updates[k] !== undefined) sanitized[k] = updates[k]; }
      const { error: dbErr } = await adminClient.from("kanban_columns").update(sanitized).eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "kanban-columns-delete") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { id } = body;
      if (!id) return jsonResponse({ success: false, error: "id required" }, 400);
      await adminClient.from("conversations").update({ kanban_column_id: null }).eq("kanban_column_id", id).eq("tenant_id", tenantId);
      const { error: dbErr } = await adminClient.from("kanban_columns").delete().eq("id", id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "kanban-columns-reorder") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { ordered_ids } = body;
      if (!ordered_ids || !Array.isArray(ordered_ids)) return jsonResponse({ success: false, error: "ordered_ids required" }, 400);
      for (let i = 0; i < ordered_ids.length; i++) {
        await adminClient.from("kanban_columns").update({ sort_order: i }).eq("id", ordered_ids[i]).eq("tenant_id", tenantId);
      }
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // USER PREFERENCES
    // ═══════════════════════════════════════════

    if (action === "user-preferences-get") {
      const { data } = await adminClient.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
      return jsonResponse({ success: true, data });
    }

    if (action === "user-preferences-upsert") {
      const allowed = ["theme", "language", "ai_default_enabled"];
      const sanitized: Record<string, unknown> = { user_id: user.id };
      for (const k of allowed) { if (body[k] !== undefined) sanitized[k] = body[k]; }
      const { error: dbErr } = await adminClient.from("user_preferences").upsert(sanitized, { onConflict: "user_id" });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // TEAM MEMBERS
    // ═══════════════════════════════════════════

    if (action === "team-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;

      const { data: members, error: dbErr } = await adminClient
        .from("tenant_members")
        .select("id, user_id, role, joined_at, profile:profiles(full_name)")
        .eq("tenant_id", tenantId)
        .order("joined_at", { ascending: true });

      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);

      const enriched = await Promise.all(
        members.map(async (m: any) => {
          let email = "---";
          try {
            const { data: userData } = await adminClient.auth.admin.getUserById(m.user_id);
            if (userData?.user?.email) email = userData.user.email;
          } catch (e) {}
          return {
            ...m,
            email,
            full_name: m.profile?.[0]?.full_name || m.profile?.full_name || "Membro",
          };
        })
      );

      return jsonResponse({ success: true, data: enriched });
    }

    if (action === "team-add") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;

      const { email, password, role, full_name } = body;
      if (!email || !password) return jsonResponse({ success: false, error: "E-mail e senha são obrigatórios" }, 400);

      const { data: myMembership } = await adminClient.from("tenant_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (myMembership?.role !== "admin") {
         return jsonResponse({ success: false, error: "Apenas administradores podem adicionar pessoas." }, 403);
      }

      let newUserId: string | undefined;

      const { data: newUser, error: authErr } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true,
      });

      if (authErr) {
        if (authErr.message.includes("already registered") || authErr.message.includes("already exists")) {
           return jsonResponse({ success: false, error: "Este e-mail já está em uso no sistema." }, 400);
        }
        return jsonResponse({ success: false, error: authErr.message }, 500);
      }
      
      if (newUser && newUser.user) {
        newUserId = newUser.user.id;
      }

      if (!newUserId) return jsonResponse({ success: false, error: "Falha ao criar o usuário" }, 500);

      const { data: autoTenant } = await adminClient.from("tenant_members").select("tenant_id").eq("user_id", newUserId).maybeSingle();
      if (autoTenant && autoTenant.tenant_id !== tenantId) {
        await adminClient.from("tenants").delete().eq("id", autoTenant.tenant_id);
      }

      const { error: insertErr } = await adminClient.from("tenant_members").insert({
        tenant_id: tenantId,
        user_id: newUserId,
        role: role || "member"
      });

      if (full_name) {
        await adminClient.from("profiles").upsert({ user_id: newUserId, tenant_id: tenantId, full_name });
      }

      if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 500);

      return jsonResponse({ success: true });
    }

    if (action === "team-remove") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;

      const { user_id } = body;
      if (!user_id) return jsonResponse({ success: false, error: "user_id is required" }, 400);

      if (user_id === user.id) return jsonResponse({ success: false, error: "Você não pode remover a si mesmo." }, 400);

      const { data: myMembership } = await adminClient.from("tenant_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (myMembership?.role !== "admin") {
         return jsonResponse({ success: false, error: "Apenas administradores podem remover pessoas." }, 403);
      }

      const { error: dbErr } = await adminClient.from("tenant_members").delete().eq("user_id", user_id).eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      
      await adminClient.auth.admin.deleteUser(user_id);

      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // DASHBOARD METRICS
    // ═══════════════════════════════════════════

    if (action === "dashboard-metrics") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { start_date, chart_days } = body;

      const baseConv = adminClient.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      const baseMsg = adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      const baseContact = adminClient.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);

      const withDate = (q: any, col: string) => start_date ? q.gte(col, start_date) : q;

      const [convRes, msgRes, instRes, contactRes, schedRes, inboundRes, outboundRes, aiRes, manualRes, sentimentRes] = await Promise.all([
        withDate(adminClient.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId), "created_at"),
        withDate(adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId), "sent_at"),
        adminClient.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "connected"),
        withDate(adminClient.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId), "created_at"),
        adminClient.from("schedules").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending"),
        withDate(adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "inbound"), "sent_at"),
        withDate(adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound"), "sent_at"),
        withDate(adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").eq("is_ai_generated", true), "sent_at"),
        withDate(adminClient.from("messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").eq("is_ai_generated", false), "sent_at"),
        adminClient.from("conversations").select("sentiment").eq("tenant_id", tenantId),
      ]);

      const metrics = {
        totalConversations: convRes.count || 0,
        totalMessages: msgRes.count || 0,
        activeInstances: instRes.count || 0,
        totalContacts: contactRes.count || 0,
        pendingSchedules: schedRes.count || 0,
        inboundMessages: inboundRes.count || 0,
        outboundMessages: outboundRes.count || 0,
        aiMessages: aiRes.count || 0,
        manualMessages: manualRes.count || 0,
        sentimentCounts: (sentimentRes.data || []).reduce((acc: any, curr: any) => {
          const s = curr.sentiment || "neutro";
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, { satisfeito: 0, neutro: 0, irritado: 0, duvida: 0 }),
      };

      // Chart data
      let chartData: any[] = [];
      if (chart_days) {
        const chartStart = new Date();
        chartStart.setDate(chartStart.getDate() - (chart_days - 1));
        chartStart.setHours(0, 0, 0, 0);

        const { data: chartMessages } = await adminClient.from("messages")
          .select("sent_at, direction, is_ai_generated")
          .eq("tenant_id", tenantId)
          .gte("sent_at", chartStart.toISOString())
          .order("sent_at", { ascending: true });

        if (chartMessages) {
          const dayMap: Record<string, { date: string; inbound: number; ai: number; manual: number }> = {};
          for (let i = 0; i < chart_days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (chart_days - 1 - i));
            const key = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
            dayMap[key] = { date: key, inbound: 0, ai: 0, manual: 0 };
          }
          for (const msg of chartMessages) {
            const dt = new Date(msg.sent_at);
            const key = String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0");
            if (!dayMap[key]) continue;
            if (msg.direction === "inbound") dayMap[key].inbound++;
            else if (msg.is_ai_generated) dayMap[key].ai++;
            else dayMap[key].manual++;
          }
          chartData = Object.values(dayMap);
        }
      }

      return jsonResponse({ success: true, data: { metrics, chartData } });
    }

    // ═══════════════════════════════════════════
    // DASHBOARD SETUP CHECK
    // ═══════════════════════════════════════════

    if (action === "dashboard-setup-check") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const [instRes, profileRes, docsRes, aiRes, prodRes] = await Promise.all([
        adminClient.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "connected"),
        adminClient.from("profiles").select("company").eq("user_id", user.id).maybeSingle(),
        adminClient.from("kb_documents").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        adminClient.from("ai_settings").select("general_instructions, business_type").eq("tenant_id", tenantId).maybeSingle(),
        adminClient.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);
      return jsonResponse({
        success: true, data: {
          whatsapp: (instRes.count || 0) > 0,
          business: !!(profileRes.data?.company?.trim()),
          document: (docsRes.count || 0) > 0,
          ai: !!(aiRes.data?.general_instructions?.trim() || aiRes.data?.business_type?.trim()),
          products: (prodRes.count || 0) > 0,
        },
      });
    }

    // ═══════════════════════════════════════════
    // WHATSAPP INSTANCES (read only for pages)
    // ═══════════════════════════════════════════

    if (action === "whatsapp-instances-list-brief") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { data, error: dbErr } = await adminClient.from("whatsapp_instances")
        .select("id, instance_name, status").eq("tenant_id", tenantId);
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    // ═══════════════════════════════════════════
    // ROADMAP VOTES
    // ═══════════════════════════════════════════

    if (action === "roadmap-vote") {
      const { item_id } = body;
      if (!item_id) return jsonResponse({ success: false, error: "item_id required" }, 400);
      // Check if already voted
      const { data: existing } = await adminClient.from("roadmap_votes")
        .select("id").eq("roadmap_item_id", item_id).eq("user_id", user.id).maybeSingle();
      if (existing) {
        await adminClient.from("roadmap_votes").delete().eq("id", existing.id);
      } else {
        await adminClient.from("roadmap_votes").insert({ roadmap_item_id: item_id, user_id: user.id });
      }
      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // ROADMAP ITEMS (public read)
    // ═══════════════════════════════════════════

    if (action === "roadmap-items-list") {
      const { data, error: dbErr } = await adminClient.from("roadmap_items").select("*")
        .eq("visible", true).order("sort_order", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "roadmap-votes-list") {
      const { data } = await adminClient.from("roadmap_votes").select("roadmap_item_id, user_id");
      return jsonResponse({ success: true, data: data || [] });
    }

    // ═══════════════════════════════════════════
    // PLANS (public read)
    // ═══════════════════════════════════════════

    if (action === "plans-list-public") {
      const { data, error: dbErr } = await adminClient.from("plans").select("*")
        .eq("active", true).order("price_cents", { ascending: true });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (action === "subscription-get") {
      const tenantId = await getTenant();
      if (!tenantId) return jsonResponse({ success: true, data: null });
      const { data } = await adminClient.from("subscriptions").select("*")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return jsonResponse({ success: true, data });
    }

    // ═══════════════════════════════════════════
    // USER ROLE
    // ═══════════════════════════════════════════

    if (action === "user-role-get") {
      const { data } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
      return jsonResponse({ success: true, data: data || [] });
    }

    // ═══════════════════════════════════════════
    // FLOATING BUTTON (public read)
    // ═══════════════════════════════════════════

    if (action === "floating-btn-phone") {
      const { data } = await adminClient.from("floating_button_settings").select("phone, default_message").limit(1).maybeSingle();
      return jsonResponse({ success: true, data });
    }

    // ═══════════════════════════════════════════
    // CONVERSATION TRANSFER
    // ═══════════════════════════════════════════

    if (action === "conversations-transfer") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { conversation_id, to_instance_id, notes } = body;
      if (!conversation_id || !to_instance_id) return jsonResponse({ success: false, error: "conversation_id and to_instance_id required" }, 400);

      // Verify conversation belongs to tenant
      const { data: conv } = await adminClient.from("conversations").select("id, instance_id")
        .eq("id", conversation_id).eq("tenant_id", tenantId).maybeSingle();
      if (!conv) return jsonResponse({ success: false, error: "Conversation not found" }, 404);

      // Verify target instance belongs to tenant and is connected
      const { data: targetInst } = await adminClient.from("whatsapp_instances").select("id, status")
        .eq("id", to_instance_id).eq("tenant_id", tenantId).maybeSingle();
      if (!targetInst) return jsonResponse({ success: false, error: "Target instance not found" }, 404);
      if (targetInst.status !== "connected") return jsonResponse({ success: false, error: "Target instance is not connected" }, 400);

      if (conv.instance_id === to_instance_id) return jsonResponse({ success: false, error: "Conversation already on this instance" }, 400);

      // Log the transfer
      await adminClient.from("conversation_transfers").insert({
        conversation_id,
        from_instance_id: conv.instance_id,
        to_instance_id,
        transferred_by: user.id,
        tenant_id: tenantId,
        notes: notes || null,
      });

      // Update conversation instance
      const { error: updateErr } = await adminClient.from("conversations")
        .update({ instance_id: to_instance_id }).eq("id", conversation_id).eq("tenant_id", tenantId);
      if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 500);

      return jsonResponse({ success: true });
    }

    if (action === "conversation-transfers-list") {
      const { tenantId, error } = await verifyTenant();
      if (error) return error;
      const { conversation_id } = body;
      if (!conversation_id) return jsonResponse({ success: false, error: "conversation_id required" }, 400);
      const { data, error: dbErr } = await adminClient.from("conversation_transfers").select("*")
        .eq("conversation_id", conversation_id).eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (dbErr) return jsonResponse({ success: false, error: dbErr.message }, 500);
      return jsonResponse({ success: true, data });
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (e) {
    console.error("data-api error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
