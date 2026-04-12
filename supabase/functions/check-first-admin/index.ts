import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // 2. Validate token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = authUser.id;

    // 3. Use service role for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 4. Check if any admin already exists using security definer function
    const { data: adminExists, error: adminCheckError } = await adminClient
      .rpc("check_admins_exist");

    if (adminCheckError) {
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminExists) {
      // Check if the current user is admin
      const { data: currentRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      // NEW: Also check if this admin has a tenant. If not, create one.
      const { data: membership } = await adminClient
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!!currentRole && !membership) {
        console.log("Admin found without tenant, creating default...");
        await createDefaultTenant(adminClient, userId, authUser.email || "Admin");
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            is_first_user: false,
            is_admin: !!currentRole,
            message: "System already has an admin",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. No admins exist — promote this user to admin
    const { error: insertError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to assign admin role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create tenant for this new first admin
    await createDefaultTenant(adminClient, userId, authUser.email || "Admin");

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          is_first_user: true,
          is_admin: true,
          message: "First user promoted to system admin and tenant created",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-first-admin crash:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function createDefaultTenant(adminClient: any, userId: string, email: string) {
  const companyName = email.split("@")[0] || "Minha Empresa";
  const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Math.random().toString(36).substring(2, 7)}`;

  const { data: tenant } = await adminClient
    .from("tenants")
    .insert({ name: companyName, slug })
    .select()
    .single();

  if (tenant) {
    await adminClient.from("tenant_members").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "admin"
    });

    await adminClient.from("profiles").update({
      tenant_id: tenant.id,
      company: companyName
    }).eq("user_id", userId);

    // Get first active plan
    const { data: plan } = await adminClient
      .from("plans")
      .select("id")
      .eq("active", true)
      .order("price_cents", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (plan) {
      await adminClient.from("subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: "trial",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }
}
