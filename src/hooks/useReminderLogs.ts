import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ReminderLog {
  id: string;
  schedule_id: string;
  reminder_key: string;
  tenant_id: string;
  sent_at: string;
  schedule?: {
    title: string;
    scheduled_at: string;
    contact?: {
      name: string;
      phone: string;
    } | null;
  } | null;
}

export function useReminderLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "reminder-logs-list" },
    });
    if (!error && data?.success) setLogs(data.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}
