import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Reminder {
  id?: string;
  tenant_id: string;
  reminder_key: string;
  title: string;
  description: string;
  enabled: boolean;
  message: string;
  offset_minutes: number;
}

export function useReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "reminders-list" },
    });
    if (!error && data?.success && data.data?.length > 0) {
      setReminders(data.data);
    } else {
      setReminders([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const toggleReminder = async (reminderKey: string) => {
    const r = reminders.find((rem) => rem.reminder_key === reminderKey);
    if (!r) return;
    const newEnabled = !r.enabled;

    if (r.id) {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "reminders-update", id: r.id, enabled: newEnabled },
      });
      if (error || !data?.success) { toast.error("Erro ao atualizar lembrete"); return; }
    }
    setReminders((prev) => prev.map((rem) => rem.reminder_key === reminderKey ? { ...rem, enabled: newEnabled } : rem));
  };

  const updateReminder = async (reminder: Reminder) => {
    if (reminder.id) {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          _action: "reminders-update", id: reminder.id,
          title: reminder.title, description: reminder.description,
          enabled: reminder.enabled, message: reminder.message,
          offset_minutes: reminder.offset_minutes,
        },
      });
      if (error || !data?.success) { toast.error("Erro ao salvar lembrete"); return; }
    } else {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: {
          _action: "reminders-create",
          reminder_key: reminder.reminder_key, title: reminder.title,
          description: reminder.description, enabled: reminder.enabled,
          message: reminder.message, offset_minutes: reminder.offset_minutes,
        },
      });
      if (error || !data?.success) { toast.error("Erro ao salvar lembrete"); return; }
    }
    toast.success("Lembrete salvo!");
    fetchReminders();
  };

  const createReminder = async (reminder: Omit<Reminder, "id" | "tenant_id">) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "reminders-create", ...reminder },
    });
    if (error || !data?.success) { toast.error("Erro ao criar lembrete"); return; }
    toast.success("Lembrete criado!");
    fetchReminders();
  };

  const deleteReminder = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "reminders-delete", id },
    });
    if (error || !data?.success) { toast.error("Erro ao excluir lembrete"); return; }
    toast.success("Lembrete excluído!");
    fetchReminders();
  };

  return { reminders, loading, toggleReminder, updateReminder, createReminder, deleteReminder, setReminders };
}
