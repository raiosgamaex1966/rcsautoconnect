import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const WEEKDAY_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export interface BusinessHour {
  id?: string;
  tenant_id: string;
  day_of_week: number;
  day_name: string;
  enabled: boolean;
  open_time: string;
  close_time: string;
  break_start: string;
  break_end: string;
  interval_label: string;
}

export function useBusinessHours() {
  const { user } = useAuth();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const fetchHours = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "business-hours-list" },
    });

    if (!error && data?.success && data.data && data.data.length > 0) {
      setTenantId(data.tenant_id);
      setHours(data.data.map((d: any) => ({ ...d, day_name: WEEKDAY_FULL[d.day_of_week] })));
    } else {
      const tid = data?.tenant_id || null;
      setTenantId(tid);
      setHours(WEEKDAY_FULL.map((name, i) => ({
        tenant_id: tid || "",
        day_of_week: i,
        day_name: name,
        enabled: false,
        open_time: "09:00",
        close_time: "18:00",
        break_start: "",
        break_end: "",
        interval_label: "30 min",
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHours(); }, [fetchHours]);

  const saveAll = async (updatedHours: BusinessHour[]) => {
    const rows = updatedHours.map((h) => ({
      day_of_week: h.day_of_week, enabled: h.enabled,
      open_time: h.open_time, close_time: h.close_time,
      break_start: h.break_start, break_end: h.break_end, interval_label: h.interval_label,
    }));

    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "business-hours-upsert", rows },
    });

    if (error || !data?.success) { toast.error("Erro ao salvar horários"); return; }
    toast.success("Horários salvos!");
    fetchHours();
  };

  return { hours, loading, setHours, saveAll };
}
