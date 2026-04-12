import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
}

export interface Conversation {
  id: string;
  contact_id: string;
  instance_id: string | null;
  status: "open" | "closed" | "pending";
  unread_count: number;
  last_message_at: string | null;
  kanban_column_id: string | null;
  created_at: string;
  contact: Contact;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string;
  media_type: string | null;
  media_url: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_ai_generated: boolean;
}

type RefreshOptions = {
  background?: boolean;
};

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const cached = localStorage.getItem("zapmax_conversations");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchConversations = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    if (!user) return;
    if (isFetchingRef.current) return;

    // Silent loading
    // if (!background) setLoading(true);
    isFetchingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "conversations-list" },
      });

      if (error) {
        console.error("Error fetching conversations:", error);
      } else if (data?.success) {
        const list = (data.data || []).map((c: any) => ({
          ...c,
          contact: c.contact || { id: c.contact_id, name: "Desconhecido", phone: "", avatar_url: null },
        }));
        setConversations(list);
        localStorage.setItem("zapmax_conversations", JSON.stringify(list));
      }
    } catch (error) {
      console.error("Unexpected error fetching conversations:", error);
    } finally {
      isFetchingRef.current = false;
      if (!background) setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        fetchConversations({ background: true });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  // Polling fallback
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { fetchConversations({ background: true }); }, 5000);
    return () => clearInterval(interval);
  }, [user, fetchConversations]);

  const markAsRead = useCallback(async (conversationId: string) => {
    await supabase.functions.invoke("data-api", {
      body: { _action: "conversations-mark-read", id: conversationId },
    });
  }, []);

  const updateStatus = useCallback(async (conversationId: string, status: "open" | "closed" | "pending") => {
    await supabase.functions.invoke("data-api", {
      body: { _action: "conversations-update-status", id: conversationId, status },
    });
  }, []);

  const updateKanban = useCallback(async (conversationId: string, kanbanColumnId: string | null) => {
    await supabase.functions.invoke("data-api", {
      body: { _action: "conversations-update-kanban", id: conversationId, kanban_column_id: kanbanColumnId },
    });
  }, []);

  return { conversations, loading, fetchConversations, markAsRead, updateStatus, updateKanban };
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!conversationId) return [];
    const cached = localStorage.getItem(`zapmax_messages_${conversationId}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchMessages = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    // Silent loading
    // if (!background) setLoading(true);
    isFetchingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "messages-list", conversation_id: conversationId },
      });

      if (error) {
        console.error("Error fetching messages:", error);
      } else if (data?.success) {
        setMessages(data.data || []);
        if (conversationId) {
          localStorage.setItem(`zapmax_messages_${conversationId}`, JSON.stringify(data.data || []));
        }
      }
    } catch (error) {
      console.error("Unexpected error fetching messages:", error);
    } finally {
      isFetchingRef.current = false;
      if (!background) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => {
          const incoming = payload.new as Message;
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Polling fallback
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => { fetchMessages({ background: true }); }, 5000);
    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  return { messages, loading };
}
