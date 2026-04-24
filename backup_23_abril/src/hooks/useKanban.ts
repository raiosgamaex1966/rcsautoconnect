import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KanbanColumn {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface KanbanConversation {
  id: string;
  contact_id: string;
  instance_id: string | null;
  status: "open" | "closed" | "pending";
  unread_count: number;
  last_message_at: string | null;
  kanban_column_id: string | null;
  contact: {
    id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
    tags: string[] | null;
  };
}

export function useKanban() {
  const { user } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>(() => {
    const cached = localStorage.getItem("zapmax_kanban_columns");
    return cached ? JSON.parse(cached) : [];
  });
  const [conversations, setConversations] = useState<KanbanConversation[]>(() => {
    const cached = localStorage.getItem("zapmax_kanban_conversations");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const fetchColumns = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-list" },
    });
    if (!error && data?.success) {
      setColumns(data.data || []);
      localStorage.setItem("zapmax_kanban_columns", JSON.stringify(data.data || []));
      if (data.tenant_id) setTenantId(data.tenant_id);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "conversations-list" },
    });
    if (!error && data?.success) {
      const list = (data.data || []).map((c: any) => ({
        ...c,
        contact: c.contact || { id: c.contact_id, name: "Desconhecido", phone: "", avatar_url: null, tags: null },
      }));
      setConversations(list);
      localStorage.setItem("zapmax_kanban_conversations", JSON.stringify(list));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // setLoading(true);
    Promise.all([fetchColumns(), fetchConversations()]).finally(() => setLoading(false));
  }, [user, fetchColumns, fetchConversations]);

  // Realtime for columns
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("kanban-columns-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns" }, () => fetchColumns())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchColumns]);

  // Realtime for conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("kanban-convs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  const createColumn = useCallback(async (name: string, color: string) => {
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-create", name, color, sort_order: maxOrder },
    });
    if (!error && data?.success) await fetchColumns();
    return { error: error?.message || (data?.success ? undefined : data?.error) };
  }, [columns, fetchColumns]);

  const updateColumn = useCallback(async (id: string, updates: Partial<Pick<KanbanColumn, "name" | "color" | "sort_order">>) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-update", id, ...updates },
    });
    if (!error && data?.success) await fetchColumns();
    return { error: error?.message || (data?.success ? undefined : data?.error) };
  }, [fetchColumns]);

  const deleteColumn = useCallback(async (id: string) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-delete", id },
    });
    if (!error && data?.success) {
      await fetchColumns();
      await fetchConversations();
    }
    return { error: error?.message || (data?.success ? undefined : data?.error) };
  }, [fetchColumns, fetchConversations]);

  const moveConversation = useCallback(async (conversationId: string, columnId: string | null) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "conversations-update-kanban", id: conversationId, kanban_column_id: columnId },
    });
    if (!error && data?.success) await fetchConversations();
    return { error: error?.message || (data?.success ? undefined : data?.error) };
  }, [fetchConversations]);

  const reorderColumns = useCallback(async (orderedIds: string[]) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-reorder", ordered_ids: orderedIds },
    });
    if (!error && data?.success) await fetchColumns();
  }, [fetchColumns]);

  return {
    columns, conversations, loading, tenantId,
    createColumn, updateColumn, deleteColumn, moveConversation, reorderColumns, fetchConversations,
  };
}
