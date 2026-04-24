import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppInstance {
  id: string;
  tenant_id: string;
  instance_name: string;
  phone: string | null;
  status: "connected" | "disconnected" | "error" | "connecting";
  qr_code: string | null;
  evolution_instance_id: string | null;
  created_at: string;
}

export function useWhatsAppInstances() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>(() => {
    const cached = localStorage.getItem("zapmax_whatsapp_instances");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(() => !!localStorage.getItem("zapmax_whatsapp_instances"));

  const fetchInstances = useCallback(async () => {
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "list" },
    });
    if (error && !data) {
      console.error("Fetch instances error:", error);
      toast.error("Erro ao carregar instâncias");
      setLoading(false);
      return;
    }
    if (data?.success) {
      const list: WhatsAppInstance[] = data.data || [];
      setInstances(list);
      localStorage.setItem("zapmax_whatsapp_instances", JSON.stringify(list));
      
      // Auto-check status for instances pending sync (status/phone)
      for (const inst of list) {
        const shouldCheck =
          inst.status === "connecting" ||
          inst.status === "disconnected" ||
          (inst.status === "connected" && !inst.phone);

        if (shouldCheck) {
          supabase.functions.invoke("whatsapp-instances", {
            body: { _action: "check-status", instance_id: inst.id },
          }).then(({ data: statusData }) => {
            if (!statusData?.success) return; // silently ignore 404/errors
            const nextStatus = statusData?.data?.status;
            const nextPhone = statusData?.data?.phone ?? null;

            if (nextStatus !== inst.status || nextPhone !== (inst.phone ?? null)) {
              setInstances(prev => {
                const updated = prev.map(i =>
                  i.id === inst.id ? { ...i, status: nextStatus, phone: nextPhone } : i
                );
                localStorage.setItem("zapmax_whatsapp_instances", JSON.stringify(updated));
                return updated;
              });
            }
          }).catch(() => {});
        }
      }
      setHasFetched(true);
    }
    setLoading(false);
  }, []);

  const createInstance = useCallback(async (instanceName: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "create", instance_name: instanceName },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao criar instância");
      return null;
    }
    toast.success("Instância criada!");
    await fetchInstances();
    return data.data;
  }, [fetchInstances]);

  const connectInstance = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "connect", instance_id: instanceId },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao conectar");
      return null;
    }
    await fetchInstances();
    return data.data;
  }, [fetchInstances]);

  const disconnectInstance = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "disconnect", instance_id: instanceId },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao desconectar");
      return;
    }
    toast.success("Instância desconectada");
    await fetchInstances();
  }, [fetchInstances]);

  const deleteInstance = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "delete", instance_id: instanceId },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao excluir");
      return;
    }
    toast.success("Instância excluída");
    await fetchInstances();
  }, [fetchInstances]);

  const checkInstanceStatus = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "check-status", instance_id: instanceId },
    });
    if (error || !data?.success) return null;
    return data.data as { status: string; phone: string | null };
  }, []);

  const setWebhook = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "set-webhook", instance_id: instanceId },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao configurar webhook");
      return null;
    }
    toast.success("Webhook configurado!");
    return data.data;
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return { instances, loading, hasFetched, fetchInstances, createInstance, connectInstance, disconnectInstance, deleteInstance, checkInstanceStatus, setWebhook };
}
