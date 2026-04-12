import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "services-list" },
    });
    if (!error && data?.success) setServices(data.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const createService = async (svc: { name: string; description?: string; duration_minutes?: number; price_cents?: number; active?: boolean }) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "services-create", ...svc },
    });
    if (error || !data?.success) { toast.error("Erro ao criar serviço"); return; }
    toast.success("Serviço criado!");
    fetchServices();
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "services-update", id, ...updates },
    });
    if (error || !data?.success) { toast.error("Erro ao atualizar serviço"); return; }
    toast.success("Serviço atualizado!");
    fetchServices();
  };

  const deleteService = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "services-delete", id },
    });
    if (error || !data?.success) { toast.error("Erro ao excluir serviço"); return; }
    toast.success("Serviço excluído!");
    fetchServices();
  };

  return { services, loading, createService, updateService, deleteService };
}
