import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function: manage-scheduling
 * 
 * Handles scheduling operations called by the AI agent via function calling.
 * Actions:
 *   - check_availability: check open slots for a given date
 *   - create_schedule: book an appointment
 *   - list_schedules: list upcoming appointments for a contact
 *   - cancel_schedule: cancel an appointment
 *   - list_services: list available services
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { _action, tenant_id, ...params } = body;

    if (!_action || !tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "Invalid payload: _action and tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ LIST SERVICES ============
    if (_action === "list_services") {
      const { data: services } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents")
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .order("name");

      return new Response(JSON.stringify({
        success: true,
        data: (services || []).map(s => ({
          ...s,
          price_formatted: `R$ ${(s.price_cents / 100).toFixed(2).replace(".", ",")}`,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ CHECK AVAILABILITY ============
    if (_action === "check_availability") {
      const { date, service_id } = params;
      if (!date) {
        return new Response(JSON.stringify({ success: false, error: "date is required (YYYY-MM-DD)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get day of week (0=Sunday, 6=Saturday)
      const targetDate = new Date(date + "T12:00:00Z");
      const dayOfWeek = targetDate.getUTCDay();

      // Check if date is blocked
      const { data: blocked } = await supabase
        .from("blocked_dates")
        .select("id, reason")
        .eq("tenant_id", tenant_id)
        .eq("blocked_date", date)
        .maybeSingle();

      if (blocked) {
        return new Response(JSON.stringify({
          success: true,
          data: { available: false, reason: blocked.reason || "Data bloqueada", slots: [] },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get business hours for this day
      const { data: hours } = await supabase
        .from("business_hours")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("day_of_week", dayOfWeek)
        .eq("enabled", true)
        .maybeSingle();

      if (!hours) {
        return new Response(JSON.stringify({
          success: true,
          data: { available: false, reason: "Não funciona neste dia da semana", slots: [] },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Determine service duration
      let durationMinutes = 30;
      if (service_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("duration_minutes")
          .eq("id", service_id)
          .single();
        if (svc) durationMinutes = svc.duration_minutes;
      }

      // Generate time slots
      const slots: string[] = [];
      const [openH, openM] = hours.open_time.split(":").map(Number);
      const [closeH, closeM] = hours.close_time.split(":").map(Number);
      const breakStart = hours.break_start ? hours.break_start.split(":").map(Number) : null;
      const breakEnd = hours.break_end ? hours.break_end.split(":").map(Number) : null;

      let currentMin = openH * 60 + openM;
      const endMin = closeH * 60 + closeM;
      const breakStartMin = breakStart ? breakStart[0] * 60 + breakStart[1] : null;
      const breakEndMin = breakEnd ? breakEnd[0] * 60 + breakEnd[1] : null;

      while (currentMin + durationMinutes <= endMin) {
        // Skip break period
        if (breakStartMin !== null && breakEndMin !== null) {
          if (currentMin >= breakStartMin && currentMin < breakEndMin) {
            currentMin = breakEndMin;
            continue;
          }
          if (currentMin < breakStartMin && currentMin + durationMinutes > breakStartMin) {
            currentMin = breakEndMin;
            continue;
          }
        }

        const h = Math.floor(currentMin / 60).toString().padStart(2, "0");
        const m = (currentMin % 60).toString().padStart(2, "0");
        slots.push(`${h}:${m}`);

        // Use interval from business_hours or default to duration
        const intervalMatch = (hours.interval_label || "").match(/(\d+)/);
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : durationMinutes;
        currentMin += interval;
      }

      // Remove slots that conflict with existing schedules
      const dayStart = `${date}T00:00:00-03:00`;
      const dayEnd = `${date}T23:59:59-03:00`;

      const { data: existingSchedules } = await supabase
        .from("schedules")
        .select("scheduled_at, duration_minutes")
        .eq("tenant_id", tenant_id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .in("status", ["pending", "confirmed"]);

      const availableSlots = slots.filter(slot => {
        const slotStart = new Date(`${date}T${slot}:00-03:00`).getTime();
        const slotEnd = slotStart + durationMinutes * 60000;

        return !(existingSchedules || []).some(sch => {
          const schStart = new Date(sch.scheduled_at).getTime();
          const schEnd = schStart + (sch.duration_minutes || 30) * 60000;
          return slotStart < schEnd && slotEnd > schStart;
        });
      });

      return new Response(JSON.stringify({
        success: true,
        data: { available: availableSlots.length > 0, slots: availableSlots, date },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ CREATE SCHEDULE ============
    if (_action === "create_schedule") {
      const { contact_id, date, time, title, description, service_id } = params;
      if (!contact_id || !date || !time) {
        return new Response(JSON.stringify({ success: false, error: "contact_id, date (YYYY-MM-DD), and time (HH:MM) are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let durationMinutes = 30;
      let serviceName = title || "Agendamento";
      if (service_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("duration_minutes, name")
          .eq("id", service_id)
          .single();
        if (svc) {
          durationMinutes = svc.duration_minutes;
          serviceName = svc.name;
        }
      }

      const scheduledAt = `${date}T${time}:00-03:00`;

      // Get a tenant member to use as created_by
      const { data: member } = await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .single();

      if (!member) {
        return new Response(JSON.stringify({ success: false, error: "No tenant member found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: schedule, error } = await supabase
        .from("schedules")
        .insert({
          tenant_id,
          contact_id,
          title: serviceName,
          description: description || null,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          created_by: member.user_id,
          status: "confirmed",
        })
        .select("id, title, scheduled_at, duration_minutes, status")
        .single();

      if (error) {
        console.error("Create schedule error:", error);
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar agendamento" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data: schedule }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ LIST SCHEDULES ============
    if (_action === "list_schedules") {
      const { contact_id } = params;

      let query = supabase
        .from("schedules")
        .select("id, title, description, scheduled_at, duration_minutes, status, contact:contacts(name, phone)")
        .eq("tenant_id", tenant_id)
        .in("status", ["pending", "confirmed"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(20);

      if (contact_id) {
        query = query.eq("contact_id", contact_id);
      }

      const { data: schedules, error } = await query;

      if (error) {
        console.error("List schedules error:", error);
        return new Response(JSON.stringify({ success: false, error: "Erro ao listar agendamentos" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: (schedules || []).map(s => ({
          ...s,
          scheduled_at_formatted: new Date(s.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ CANCEL SCHEDULE ============
    if (_action === "cancel_schedule") {
      const { schedule_id, contact_id } = params;

      if (!schedule_id && !contact_id) {
        return new Response(JSON.stringify({ success: false, error: "schedule_id or contact_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .eq("tenant_id", tenant_id);

      if (schedule_id) {
        query = query.eq("id", schedule_id);
      } else if (contact_id) {
        // Cancel next upcoming schedule for this contact
        const { data: nextSchedule } = await supabase
          .from("schedules")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("contact_id", contact_id)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .single();

        if (!nextSchedule) {
          return new Response(JSON.stringify({ success: false, error: "Nenhum agendamento futuro encontrado" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        query = query.eq("id", nextSchedule.id);
      }

      const { error } = await query;
      if (error) {
        console.error("Cancel schedule error:", error);
        return new Response(JSON.stringify({ success: false, error: "Erro ao cancelar agendamento" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data: { cancelled: true } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ UPDATE SCHEDULE (RESCHEDULE) ============
    if (_action === "update_schedule") {
      const { schedule_id, contact_id, date, time, service_id } = params;

      // Find the schedule to update
      let targetScheduleId = schedule_id;
      if (!targetScheduleId && contact_id) {
        const { data: nextSchedule } = await supabase
          .from("schedules")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("contact_id", contact_id)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .single();

        if (!nextSchedule) {
          return new Response(JSON.stringify({ success: false, error: "Nenhum agendamento futuro encontrado para alterar" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetScheduleId = nextSchedule.id;
      }

      if (!targetScheduleId) {
        return new Response(JSON.stringify({ success: false, error: "schedule_id or contact_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = {};

      if (date && time) {
        updateData.scheduled_at = `${date}T${time}:00-03:00`;
      } else if (date) {
        // Keep existing time, change date
        const { data: existing } = await supabase
          .from("schedules")
          .select("scheduled_at")
          .eq("id", targetScheduleId)
          .single();
        if (existing) {
          const existingTime = new Date(existing.scheduled_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
          updateData.scheduled_at = `${date}T${existingTime}:00-03:00`;
        }
      } else if (time) {
        const { data: existing } = await supabase
          .from("schedules")
          .select("scheduled_at")
          .eq("id", targetScheduleId)
          .single();
        if (existing) {
          const existingDate = new Date(existing.scheduled_at).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
          updateData.scheduled_at = `${existingDate}T${time}:00-03:00`;
        }
      }

      if (service_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("duration_minutes, name")
          .eq("id", service_id)
          .single();
        if (svc) {
          updateData.duration_minutes = svc.duration_minutes;
          updateData.title = svc.name;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Nenhuma alteração informada (date, time ou service_id)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error } = await supabase
        .from("schedules")
        .update(updateData)
        .eq("id", targetScheduleId)
        .eq("tenant_id", tenant_id)
        .select("id, title, scheduled_at, duration_minutes, status")
        .single();

      if (error) {
        console.error("Update schedule error:", error);
        return new Response(JSON.stringify({ success: false, error: "Erro ao alterar agendamento" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...updated,
          scheduled_at_formatted: new Date(updated.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: `Unknown action: ${_action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-scheduling error:", e);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
