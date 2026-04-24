import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string;
}

export function useBlockedDates() {
  const { user } = useAuth();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "blocked-dates-list" },
    });
    if (!error && data?.success) setBlockedDates(data.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const addBlock = async (date: string, reason: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "blocked-dates-create", blocked_date: date, reason },
    });
    if (error || !data?.success) { toast.error("Erro ao bloquear data"); return; }
    toast.success("Data bloqueada!");
    fetch();
  };

  const removeBlock = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "blocked-dates-delete", id },
    });
    if (error || !data?.success) { toast.error("Erro ao remover bloqueio"); return; }
    toast.success("Bloqueio removido!");
    fetch();
  };

  return { blockedDates, loading, addBlock, removeBlock };
}
