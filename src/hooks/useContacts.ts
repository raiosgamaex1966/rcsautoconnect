import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = localStorage.getItem("zapmax_contacts");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-list" },
    });
    if (error) {
      console.error("Error fetching contacts:", error);
    } else if (data?.success) {
      setContacts(data.data || []);
      localStorage.setItem("zapmax_contacts", JSON.stringify(data.data || []));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createContact = useCallback(async (contact: { name: string; phone: string; email?: string; tags?: string[]; notes?: string }) => {
    if (!user) return { error: "Not authenticated" };
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-create", ...contact },
    });
    if (error || !data?.success) {
      return { error: data?.error || error?.message || "Error" };
    }
    await fetchContacts();
    return { error: undefined };
  }, [user, fetchContacts]);

  const updateContact = useCallback(async (id: string, updates: Partial<Pick<Contact, "name" | "phone" | "email" | "tags" | "notes">>) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-update", id, updates },
    });
    if (error || !data?.success) {
      return { error: data?.error || error?.message || "Error" };
    }
    await fetchContacts();
    return { error: undefined };
  }, [fetchContacts]);

  const deleteContact = useCallback(async (id: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-delete", id },
    });
    if (error || !data?.success) {
      return { error: data?.error || error?.message || "Error" };
    }
    await fetchContacts();
    return { error: undefined };
  }, [fetchContacts]);

  const bulkCreate = useCallback(async (
    rows: { name: string; phone: string; email?: string; tags?: string[] }[],
    onProgress?: (current: number, total: number) => void,
  ) => {
    if (!user) return { error: "Not authenticated", imported: 0 };

    const BATCH_SIZE = 500;
    let imported = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "contacts-bulk-create", rows: batch },
      });
      if (error || !data?.success) {
        return { error: data?.error || error?.message || "Error", imported };
      }
      imported += data.data?.imported || batch.length;
      onProgress?.(imported, rows.length);
      await new Promise((r) => setTimeout(r, 50));
    }

    await fetchContacts();
    return { error: undefined, imported };
  }, [user, fetchContacts]);

  const getConversationForContact = useCallback(async (contactId: string) => {
    const { data } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-get-conversation", contact_id: contactId },
    });
    return data?.data?.id || null;
  }, []);

  const startConversation = useCallback(async (contactId: string, instanceId: string) => {
    if (!user) return { error: "Not authenticated", id: null };
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "contacts-start-conversation", contact_id: contactId, instance_id: instanceId },
    });
    if (error || !data?.success) {
      return { error: data?.error || error?.message || "Error", id: null };
    }
    return { error: null, id: data.data.id };
  }, [user]);

  return { contacts, loading, fetchContacts, createContact, updateContact, deleteContact, bulkCreate, getConversationForContact, startConversation };
}
