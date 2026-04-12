import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  contact_id: string | null;
  contact?: { name: string; phone: string } | null;
  created_at: string;
}

export function useSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const cached = localStorage.getItem("zapmax_schedules");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "schedules-list" },
    });
    if (error) {
      console.error("Error fetching schedules:", error);
    } else if (data?.success) {
      const list = (data.data || []).map((s: any) => ({
        ...s,
        contact: s.contact || null,
      }));
      setSchedules(list);
      localStorage.setItem("zapmax_schedules", JSON.stringify(list));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const createSchedule = useCallback(
    async (schedule: {
      title: string;
      description?: string;
      scheduled_at: string;
      duration_minutes?: number;
      contact_id?: string;
    }) => {
      if (!user) return null;
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "schedules-create", ...schedule },
      });
      if (error || !data?.success) {
        toast.error("Erro ao criar agendamento");
        return null;
      }
      toast.success("Agendamento criado!");
      await fetchSchedules();
      return data.data;
    },
    [user, fetchSchedules]
  );

  const updateScheduleStatus = useCallback(
    async (id: string, status: Schedule["status"]) => {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "schedules-update-status", id, status },
      });
      if (error || !data?.success) {
        toast.error("Erro ao atualizar status");
        return;
      }
      toast.success("Status atualizado!");
      await fetchSchedules();
    },
    [fetchSchedules]
  );

  const updateSchedule = useCallback(
    async (id: string, updates: {
      title?: string;
      description?: string;
      scheduled_at?: string;
      duration_minutes?: number;
      contact_id?: string;
      status?: Schedule["status"];
    }) => {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "schedules-update", id, ...updates },
      });
      if (error || !data?.success) {
        toast.error("Erro ao atualizar agendamento");
        return null;
      }
      toast.success("Agendamento atualizado!");
      await fetchSchedules();
      return data.data;
    },
    [fetchSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "schedules-delete", id },
      });
      if (error || !data?.success) {
        toast.error("Erro ao excluir agendamento");
        return;
      }
      toast.success("Agendamento excluído!");
      await fetchSchedules();
    },
    [fetchSchedules]
  );

  return { schedules, loading, fetchSchedules, createSchedule, updateSchedule, updateScheduleStatus, deleteSchedule };
}
