import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Validate user token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    // 2. Validate payload
    const body = await req.json();
    const { company_name, plan_id } = body;
    if (!company_name || typeof company_name !== "string" || company_name.trim().length < 2) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload: company_name required (min 2 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 3. Check if user already has a tenant
    const { data: existingMember } = await adminClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ success: false, error: "User already belongs to a tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create tenant
    const slug = company_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .insert({ name: company_name.trim(), slug: uniqueSlug })
      .select()
      .single();

    if (tenantError) {
      return new Response(JSON.stringify({ success: false, error: "Failed to create tenant" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("tenant_members").insert({
      tenant_id: tenant.id, user_id: userId, role: "admin",
    });

    // Also add to user_roles for frontend visibility
    await adminClient.from("user_roles").insert({
      user_id: userId, role: "admin",
    });

    // 7. Update profile with tenant
    await adminClient.from("profiles").update({
      tenant_id: tenant.id, company: company_name.trim(),
    }).eq("user_id", userId);

    // 8. Create subscription (trial) — respects auto_trial setting
    let selectedPlanId = plan_id;
    if (!selectedPlanId) {
      const { data: freePlan } = await adminClient
        .from("plans")
        .select("id, trial_days")
        .eq("active", true)
        .order("price_cents", { ascending: true })
        .limit(1)
        .single();
      selectedPlanId = freePlan?.id;
    }

    if (selectedPlanId) {
      const { data: planData } = await adminClient
        .from("plans")
        .select("trial_days, price_cents")
        .eq("id", selectedPlanId)
        .single();

      // Check if auto_trial is enabled (only relevant for free plans)
      let autoTrialEnabled = true;
      if (planData && planData.price_cents === 0) {
        const { data: sysSettings } = await adminClient
          .from("system_settings")
          .select("auto_trial")
          .limit(1)
          .maybeSingle();
        if (sysSettings) autoTrialEnabled = sysSettings.auto_trial;
      }

      if (autoTrialEnabled) {
        const trialDays = planData?.trial_days || 7;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        await adminClient.from("subscriptions").insert({
          tenant_id: tenant.id,
          plan_id: selectedPlanId,
          status: "trial",
          trial_ends_at: trialEnd.toISOString(),
          current_period_end: trialEnd.toISOString(),
        });
      } else {
        // Create subscription with suspended status — user must upgrade
        await adminClient.from("subscriptions").insert({
          tenant_id: tenant.id,
          plan_id: selectedPlanId,
          status: "suspended",
          trial_ends_at: null,
          current_period_end: null,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: { tenant_id: tenant.id, slug: uniqueSlug },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
