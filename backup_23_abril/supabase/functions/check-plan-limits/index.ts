import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseTrialEndTimestamp(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;

  // Handle date-only values as end of day in America/Sao_Paulo
  if (/^\d{4}-\d{2}-\d{2}$/.test(trialEndsAt)) {
    const parsedDateOnly = new Date(`${trialEndsAt}T23:59:59.999-03:00`).getTime();
    return Number.isNaN(parsedDateOnly) ? null : parsedDateOnly;
  }

  const parsed = new Date(trialEndsAt).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const userId = authUser.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is admin — admins bypass plan restrictions
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    // If admin, return full access immediately
    if (isAdmin) {
      return json({
        success: true,
        data: {
          is_admin: true,
          has_plan: true,
          plan: { id: "admin", name: "Administrador", price_cents: 99999, max_instances: 999, max_messages: null, max_bots: 999, max_users: 999, storage_mb: 99999, support_level: "priority" },
          subscription: { id: "admin", status: "active", trial_ends_at: null, current_period_end: null },
          usage: { instances: 0, members: 0, messages_this_month: 0, bots: 0, storage_mb: 0 },
          trial_blocked: false,
          trial_days_left: null,
        },
      });
    }

    // 2. Get tenant
    const { data: membership } = await adminClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!membership) {
      return json({ success: false, error: "No tenant found" }, 403);
    }
    const tenantId = membership.tenant_id;

    // 3. Get latest subscription + plan
    const { data: sub } = await adminClient
      .from("subscriptions")
      .select("id, status, plan_id, trial_ends_at, current_period_end")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return json({
        success: true,
        data: {
          is_admin: false,
          has_plan: false,
          plan: null,
          subscription: null,
          usage: null,
          trial_blocked: false,
          trial_days_left: 0,
        },
      });
    }

    const { data: plan } = await adminClient
      .from("plans")
      .select("*")
      .eq("id", sub.plan_id)
      .single();

    if (!plan) {
      return json({ success: false, error: "Plan not found" }, 500);
    }

    const { data: sysSettings } = await adminClient
      .from("system_settings")
      .select("auto_trial")
      .limit(1)
      .maybeSingle();

    const autoTrialEnabled = sysSettings?.auto_trial ?? true;
    const isFreePlan = plan.price_cents === 0;
    const trialBlocked = isFreePlan && !autoTrialEnabled;
    const subscriptionHasAccess = sub.status === "active" || sub.status === "trial";

    // Calculate trial days left server-side (with safe fallback for legacy rows)
    const calcTrialDaysLeft = (): number => {
      const trialEndFromField = parseTrialEndTimestamp(sub.trial_ends_at);
      const trialEndFromFallback =
        trialEndFromField === null && isFreePlan && plan.trial_days > 0 && sub.started_at
          ? new Date(sub.started_at).getTime() + plan.trial_days * DAY_IN_MS
          : null;

      const trialEndMs = trialEndFromField ?? trialEndFromFallback;
      if (trialEndMs === null || Number.isNaN(trialEndMs)) {
        return isFreePlan ? Math.max(0, plan.trial_days ?? 0) : 0;
      }

      const diff = trialEndMs - Date.now();
      return Math.max(0, Math.ceil(diff / DAY_IN_MS));
    };
    const trialDaysLeft = calcTrialDaysLeft();

    if (trialBlocked || !subscriptionHasAccess) {
      return json({
        success: true,
        data: {
          is_admin: false,
          has_plan: false,
          plan: {
            id: plan.id,
            name: plan.name,
            price_cents: plan.price_cents,
            max_instances: plan.max_instances,
            max_messages: plan.max_messages,
            max_bots: plan.max_bots,
            max_users: plan.max_users,
            storage_mb: plan.storage_mb,
            support_level: plan.support_level,
          },
          subscription: {
            id: sub.id,
            status: sub.status,
            trial_ends_at: sub.trial_ends_at,
            current_period_end: sub.current_period_end,
          },
          usage: null,
          trial_blocked: trialBlocked,
          trial_days_left: trialDaysLeft,
        },
      });
    }

    // 4. Get current usage counts
    const { count: instanceCount } = await adminClient
      .from("whatsapp_instances")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    const { count: memberCount } = await adminClient
      .from("tenant_members")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // Message count for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: messageCount } = await adminClient
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart);

    const { count: botCount } = await adminClient
      .from("ai_settings")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // 5. Calculate storage usage (kb_documents file sizes)
    const { data: docs } = await adminClient
      .from("kb_documents")
      .select("file_size_bytes")
      .eq("tenant_id", tenantId);

    const storageMb = Math.round(
      (docs || []).reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) / (1024 * 1024) * 100
    ) / 100;

    return json({
      success: true,
      data: {
        is_admin: false,
        has_plan: true,
        subscription: {
          id: sub.id,
          status: sub.status,
          trial_ends_at: sub.trial_ends_at,
          current_period_end: sub.current_period_end,
        },
        plan: {
          id: plan.id,
          name: plan.name,
          price_cents: plan.price_cents,
          max_instances: plan.max_instances,
          max_messages: plan.max_messages,
          max_bots: plan.max_bots,
          max_users: plan.max_users,
          storage_mb: plan.storage_mb,
          support_level: plan.support_level,
        },
        usage: {
          instances: instanceCount || 0,
          members: memberCount || 0,
          messages_this_month: messageCount || 0,
          bots: botCount || 0,
          storage_mb: storageMb,
        },
        trial_blocked: false,
        trial_days_left: trialDaysLeft,
      },
    });
  } catch (err) {
    console.error("check-plan-limits error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
