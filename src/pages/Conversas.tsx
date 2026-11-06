import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageCircle, Send, Bot, Phone, ArrowLeft, Loader2, Bell,
  Filter, XCircle, CheckCircle2, Clock, Sparkles, Copy, Check, Trash2,
  CalendarDays, RefreshCw, X, ArrowRightLeft, Zap, FileText, Play, Image as ImageIcon, Video,
  Info, User, Mail, CreditCard, Tag, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConversations, useMessages, type Conversation, type Message } from "@/hooks/useConversations";
import { useContacts } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useLanguage } from "@/contexts/LanguageContext";

function formatTime(dateStr: string) {
  try { return format(new Date(dateStr), "HH:mm"); } catch { return ""; }
}

function ChatBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isInbound ? "justify-start" : "justify-end"} mb-2`}
    >
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
        isInbound ? "bg-secondary rounded-bl-sm" : "bg-primary/20 border border-primary/30 rounded-br-sm"
      }`}>
        {!isInbound && (
          <div className="flex items-center gap-1 mb-1">
            {message.is_ai_generated ? (
              <>
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium text-primary">IA</span>
              </>
            ) : (
              <>
                <Bot className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Manual</span>
              </>
            )}
          </div>
        )}
        
        {/* ── Image ── */}
        {message.media_type === "image" && message.media_url && (
          <div className="mb-2 overflow-hidden rounded-lg border border-border/50 bg-background/50">
            <img
              src={message.media_url}
              alt="Imagem"
              className="max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.media_url!, "_blank")}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* ── Audio ── */}
        {message.media_type === "audio" && message.media_url && (
          <div className="mb-2 p-2.5 rounded-xl bg-background/50 border border-border/40">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Play className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-wide">Áudio</span>
            </div>
            <audio
              controls
              preload="metadata"
              className="w-full"
              style={{ height: 36 }}
            >
              <source src={message.media_url} type="audio/ogg" />
              <source src={message.media_url} type="audio/mpeg" />
              <source src={message.media_url} type="audio/mp4" />
              Seu navegador não suporta áudio.
            </audio>
          </div>
        )}

        {/* ── Video ── */}
        {message.media_type === "video" && message.media_url && (
          <div className="mb-2 overflow-hidden rounded-lg border border-border/50 bg-background/50">
            <video src={message.media_url} controls className="max-w-full h-auto" />
          </div>
        )}

        {/* ── Sticker ── */}
        {message.media_type === "sticker" && message.media_url && (
          <div className="mb-2">
            <img
              src={message.media_url}
              alt="Sticker"
              className="max-w-[160px] h-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* ── Document ── */}
        {message.media_type === "document" && message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 transition-colors group"
          >
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Documento</p>
              <p className="text-[10px] text-muted-foreground">Clique para baixar</p>
            </div>
          </a>
        )}

        {/* Message text — skip the raw "[audio]" placeholder if transcription exists */}
        {(() => {
          const isMediaPlaceholder = message.content && /^\[.+\]$/.test(message.content.trim());
          const hasTranscription = message.content?.startsWith("[Áudio transcrito:");
          if (hasTranscription) {
            // Show transcription text nicely
            const text = message.content.replace(/^\[Áudio transcrito:\s*/, "").replace(/\]$/, "");
            return (
              <div className="mt-1">
                <p className="text-[10px] text-muted-foreground italic mb-0.5">Transcrição:</p>
                <p className="text-sm whitespace-pre-line leading-relaxed">{text}</p>
              </div>
            );
          }
          if (message.media_type && isMediaPlaceholder) return null;
          return <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>;
        })()}

        <div className={`flex items-center gap-1 mt-1.5 ${isInbound ? "justify-start" : "justify-end"}`}>
          <span className="text-[10px] opacity-60 font-medium">{formatTime(message.sent_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; osc.type = "sine"; gain.gain.value = 0.3;
    osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Alert is a sequence of 3 tones
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "triangle";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(440, 0, 0.4);
    playTone(660, 0.2, 0.4);
    playTone(880, 0.4, 0.6);
  } catch {}
}

function AISuggestion({ suggestion, onSend, onDismiss, sending }: {
  suggestion: string; onSend: () => void; onDismiss: () => void; sending: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Sugestão da IA</span>
      </div>
      <div className="text-sm prose prose-sm dark:prose-invert max-w-none mb-3">
        <ReactMarkdown>{suggestion}</ReactMarkdown>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="text-xs h-7" onClick={onSend} disabled={sending}>
          {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Enviar ao cliente
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
          navigator.clipboard.writeText(suggestion);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}>
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={onDismiss}>
          Descartar
        </Button>
      </div>
    </motion.div>
  );
}

type StatusFilter = "all" | "open" | "closed" | "pending";

// statusFilters built inside component with translations

export default function Conversas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, loading: convLoading, markAsRead, updateStatus, updateKanban, fetchConversations } = useConversations();
  const { plan, usage, messageLimitReached, loading: planLimitsLoading, refetch: refetchPlanLimits } = usePlanLimits();

  const statusFilters: { value: StatusFilter; label: string; icon: React.ElementType }[] = [
    { value: "all", label: t.conversations.filters.all, icon: MessageCircle },
    { value: "open", label: t.conversations.filters.open, icon: CheckCircle2 },
    { value: "pending", label: t.conversations.filters.pending, icon: Clock },
    { value: "closed", label: t.conversations.filters.closed, icon: XCircle },
  ];
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const selectedConv = conversations.find((c) => c.id === selectedId);
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { messages, loading: msgLoading } = useMessages(selectedId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConvCountRef = useRef(0);


  // Instance filter from query param
  const instanceFilter = searchParams.get("instance");

  // AI state
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [clearConfirmId, setClearConfirmId] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  const [rescheduleData, setRescheduleData] = useState<{ id: string; date: string; time: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { updateContact } = useContacts();

  // Schedule info for selected contact
  const [contactSchedules, setContactSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [cancelScheduleId, setCancelScheduleId] = useState<string | null>(null);

  // Contact Details Form State
  const [detailsForm, setDetailsForm] = useState({
    name: "",
    email: "",
    cpf: "",
    notes: "",
    tags: [] as string[],
  });

  useEffect(() => {
    if (selectedConv?.contact) {
      setDetailsForm({
        name: selectedConv.contact.name || "",
        email: selectedConv.contact.email || "",
        cpf: selectedConv.contact.cpf || "",
        notes: selectedConv.contact.notes || "",
        tags: selectedConv.contact.tags || [],
      });
    }
  }, [selectedConv]);

  const handleUpdateContact = async () => {
    if (!selectedConv?.contact_id) return;
    const { error } = await updateContact(selectedConv.contact_id, {
      name: detailsForm.name,
      email: detailsForm.email,
      cpf: detailsForm.cpf,
      notes: detailsForm.notes,
      tags: detailsForm.tags,
    });
    if (error) {
      toast.error("Erro ao atualizar contato");
    } else {
      toast.success("Contato atualizado!");
      fetchConversations({ background: true });
    }
  };

  // Get instance names for display
  const [instanceNames, setInstanceNames] = useState<Record<string, string>>({});
  // Kanban columns for badge display
  const [kanbanColumns, setKanbanColumns] = useState<Record<string, { name: string; color: string }>>({});
  useEffect(() => {
    supabase.functions.invoke("data-api", {
      body: { _action: "whatsapp-instances-list-brief" },
    }).then(({ data }) => {
      if (data?.success && data.data) {
        const map: Record<string, string> = {};
        data.data.forEach((i: any) => { map[i.id] = i.instance_name; });
        setInstanceNames(map);
      }
    });
    supabase.functions.invoke("data-api", {
      body: { _action: "kanban-columns-list" },
    }).then(({ data }) => {
      if (data?.success && data.data) {
        const map: Record<string, { name: string; color: string }> = {};
        data.data.forEach((c: any) => { map[c.id] = { name: c.name, color: c.color }; });
        setKanbanColumns(map);
      }
    });
  }, []);

  // Get tenant id
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_user_tenant_id", { _user_id: user.id }).then(({ data }) => {
      if (data) setTenantId(data);
    });
  }, [user]);


  const filtered = useMemo(() => conversations.filter((c) => {
    const matchesSearch = c.contact.name.toLowerCase().includes(search.toLowerCase()) || c.contact.phone.includes(search);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesInstance = !instanceFilter || c.instance_id === instanceFilter;
    return matchesSearch && matchesStatus && matchesInstance;
  }), [conversations, search, statusFilter, instanceFilter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, aiSuggestion]);

  const prevPendingCountRef = useRef(0);
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
    const pendingCount = conversations.filter(c => c.status === "pending").length;

    if (prevConvCountRef.current > 0 && totalUnread > prevConvCountRef.current) {
      playNotificationSound();
      toast.info("Nova mensagem recebida!", { icon: <Bell className="h-4 w-4" />, duration: 3000 });
    }

    if (pendingCount > prevPendingCountRef.current) {
      playAlertSound();
      toast.error("⚠️ CLIENTE AGUARDANDO ATENDIMENTO HUMANO!", { 
        icon: <User className="h-5 w-5" />, 
        duration: 8000,
        style: { border: '2px solid #ef4444', fontWeight: 'bold' }
      });
    }

    // Dynamic Title Update
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) ⚠️ Pendente | ZapMax`;
    } else {
      document.title = "ZapMax V1.7";
    }

    prevConvCountRef.current = totalUnread;
    prevPendingCountRef.current = pendingCount;
  }, [conversations]);

  // Clear AI suggestion when switching conversations
  useEffect(() => { 
    setAiSuggestion(""); 
    if (selectedId) {
      localStorage.setItem("rcs_last_conv_id", selectedId);
      setSearchParams(prev => {
        prev.set("id", selectedId);
        return prev;
      }, { replace: true });
    }
  }, [selectedId]);

  // Restore last selected conversation
  useEffect(() => {
    if (!selectedId && !searchParams.get("id")) {
      const lastId = localStorage.getItem("rcs_last_conv_id");
      if (lastId) setSelectedId(lastId);
    }
  }, []);

  // Fetch schedules for selected contact
  useEffect(() => {
    if (!selectedConv?.contact_id || !tenantId) {
      setContactSchedules([]);
      return;
    }
    setSchedulesLoading(true);
    supabase
      .from("schedules")
      .select("id, title, scheduled_at, duration_minutes, status")
      .eq("tenant_id", tenantId)
      .eq("contact_id", selectedConv.contact_id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5)
      .then(({ data }) => {
        setContactSchedules(data || []);
        setSchedulesLoading(false);
      });
  }, [selectedConv?.contact_id, tenantId]);

  const handleSelect = (conv: Conversation) => {
    setSelectedId(conv.id);
    if (conv.unread_count > 0) markAsRead(conv.id);
  };

  const handleSend = async (content?: string) => {
    const msgToSend = content || newMessage.trim();
    if (!msgToSend || !selectedId || sending) return;

    if (!planLimitsLoading && messageLimitReached && plan?.max_messages !== null) {
      toast.error(`Limite mensal de ${plan.max_messages} mensagens atingido no seu plano`);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
        body: { _action: "send-message", conversation_id: selectedId, content: msgToSend },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao enviar mensagem");
      } else {
        if (!content) setNewMessage("");
        
        // If human enters a pending conversation, mark it as open to stop alerts
        if (selectedConv?.status === "pending") {
          await updateStatus(selectedId, "open");
        }
        
        void refetchPlanLimits();
      }
    } catch { toast.error("Erro ao enviar mensagem"); }
    setSending(false);
  };

  const handleAIResponse = useCallback(async () => {
    if (!selectedId || !tenantId || aiLoading) return;

    // Check if AI is enabled for this tenant
    try {
      const { data: aiSettings } = await (supabase as any)
        .from("ai_settings")
        .select("ai_enabled")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (aiSettings && aiSettings.ai_enabled === false) {
        toast.info("IA desativada. Ative nas configurações para gerar respostas.");
        return;
      }
    } catch {}

    setAiLoading(true);
    setAiSuggestion("");

    // Build context from last messages
    const recentMessages = messages.slice(-10).map((m) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); setAiLoading(false); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            messages: recentMessages, 
            tenant_id: tenantId,
            contact_id: selectedConv?.contact_id 
          }),
        }
      );

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) { toast.error("Limite de requisições excedido, tente novamente em instantes"); }
        else if (resp.status === 402) { toast.error("Créditos de IA esgotados"); }
        else { toast.error("Erro ao gerar resposta da IA"); }
        setAiLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setAiSuggestion(accumulated);
            }
          } catch { /* partial json */ }
        }
      }
    } catch (e) {
      console.error("AI error:", e);
      toast.error("Erro ao gerar resposta da IA");
    }
    setAiLoading(false);
  }, [selectedId, tenantId, aiLoading, messages]);

  const handleSendSuggestion = async () => {
    if (!aiSuggestion.trim()) return;
    setSendingSuggestion(true);
    await handleSend(aiSuggestion.trim());
    setAiSuggestion("");
    setSendingSuggestion(false);
  };

  const handleStatusChange = async (convId: string, newStatus: "open" | "closed" | "pending") => {
    await updateStatus(convId, newStatus);
    toast.success(`Conversa ${newStatus === "closed" ? "fechada" : newStatus === "open" ? "reaberta" : "marcada como pendente"}`);
  };

  const handleClearHistory = async (convId: string) => {
    try {
      // Delete all messages (this also clears AI memory since AI reads from messages table)
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", convId);
      if (error) {
        toast.error("Erro ao limpar histórico");
        console.error(error);
        return;
      }
      // Reset conversation metadata
      await supabase
        .from("conversations")
        .update({ unread_count: 0, last_message_at: null })
        .eq("id", convId);
      
      setAiSuggestion("");
      toast.success("Histórico e memória da IA limpos!");
    } catch {
      toast.error("Erro ao limpar histórico");
    }
  };

  const refreshSchedules = useCallback(async () => {
    if (!selectedConv?.contact_id || !tenantId) return;
    const { data } = await supabase
      .from("schedules")
      .select("id, title, scheduled_at, duration_minutes, status")
      .eq("tenant_id", tenantId)
      .eq("contact_id", selectedConv.contact_id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5);
    setContactSchedules(data || []);
  }, [selectedConv?.contact_id, tenantId]);

  const notifyContact = async (message: string) => {
    if (!selectedConv) return;
    try {
      await supabase.functions.invoke("whatsapp-instances", {
        body: { _action: "send-message", conversation_id: selectedConv.id, content: message },
      });
    } catch (e) {
      console.error("Notify contact error:", e);
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    const sch = contactSchedules.find((s) => s.id === scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-scheduling", {
        body: { _action: "cancel_schedule", tenant_id: tenantId, schedule_id: scheduleId },
      });
      if (error || !data?.success) {
        toast.error("Erro ao cancelar agendamento");
      } else {
        toast.success("Agendamento cancelado e contato notificado");
        refreshSchedules();
        if (sch) {
          const dt = new Date(sch.scheduled_at);
          const dateStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          const timeStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
          notifyContact(`Olá! Informamos que seu agendamento de *${sch.title}* do dia *${dateStr}* às *${timeStr}* foi *cancelado*. Se precisar remarcar, é só nos chamar!`);
        }
      }
    } catch { toast.error("Erro ao cancelar"); }
  };

  const handleReschedule = async () => {
    if (!rescheduleData) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-scheduling", {
        body: {
          _action: "update_schedule",
          tenant_id: tenantId,
          schedule_id: rescheduleData.id,
          date: rescheduleData.date,
          time: rescheduleData.time,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao remarcar");
      } else {
        toast.success("Agendamento remarcado e contato notificado!");
        const newDt = new Date(`${rescheduleData.date}T${rescheduleData.time}:00-03:00`);
        const newDateStr = newDt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const newTimeStr = newDt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        const title = data?.data?.title || "seu serviço";
        notifyContact(`Olá! Seu agendamento de *${title}* foi *remarcado* para o dia *${newDateStr}* às *${newTimeStr}*. Qualquer dúvida, estamos à disposição!`);
        setRescheduleData(null);
        refreshSchedules();
      }
    } catch { toast.error("Erro ao remarcar"); }
  };

  const statusCounts = {
    all: conversations.length,
    open: conversations.filter((c) => c.status === "open").length,
    pending: conversations.filter((c) => c.status === "pending").length,
    closed: conversations.filter((c) => c.status === "closed").length,
  };



  if (!planLimitsLoading && messageLimitReached) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-background/95 backdrop-blur-sm">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-2 animate-pulse">
          <Zap className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Limite de Mensagens Atingido</h2>
        <p className="text-muted-foreground max-w-sm">
          Seu plano ({plan?.name}) atingiu o limite mensal de <strong>{plan?.max_messages}</strong> mensagens. 
          Acesso às conversas bloqueado para garantir a integridade do sistema.
          Atualize seu plano para continuar atendendo seus clientes.
        </p>
        <div className="flex gap-3 pt-2">
          <Button onClick={() => navigate("/planos")} className="font-bold">
            Ver Planos e Upgrade
          </Button>
          <Button variant="outline" onClick={() => fetchConversations({ background: true })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Conversation List */}
      <div className={`w-full max-w-md border-r border-border flex flex-col ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-xl font-bold">{t.conversations.title}</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.conversations.search} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {statusFilters.map((f) => {
              const isPendingWithData = f.value === "pending" && statusCounts[f.value] > 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === f.value 
                      ? "bg-primary text-primary-foreground" 
                      : isPendingWithData 
                        ? "bg-red-500 text-white animate-pulse-red" 
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <f.icon className="h-3 w-3" />
                  {f.label}
                  <span className="ml-0.5 text-[10px] opacity-70">{statusCounts[f.value]}</span>
                </button>
              );
            })}
          </div>
          {instanceFilter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Instância:</span>
              <Badge variant="secondary" className="text-xs">
                {instanceNames[instanceFilter] || "..."}
              </Badge>
              <button
                onClick={() => { const p = new URLSearchParams(searchParams); p.delete("instance"); setSearchParams(p); }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">{t.conversations.noConversations}</p>
              <p className="text-xs">
                {statusFilter !== "all"
                  ? statusFilter === "open" ? t.conversations.noConversationsOpen : statusFilter === "closed" ? t.conversations.noConversationsClosed : t.conversations.noConversationsPending
                  : t.conversations.messagesAppearHere}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center gap-2 border-b border-border px-2 py-2 ${
                  selectedId === conv.id ? "bg-secondary/60" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(conv)}
                  className="flex flex-1 min-w-0 items-center gap-3 rounded-md p-2 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {conv.contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{conv.contact.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted-foreground truncate flex-1">{conv.contact.phone}</p>
                      {conv.instance_id && instanceNames[conv.instance_id] && (
                        <span className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]" title={instanceNames[conv.instance_id]}>
                          📱 {instanceNames[conv.instance_id]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1.5 pr-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 capitalize ${
                      conv.status === "open" ? "border-green-500/50 text-green-500"
                      : conv.status === "pending" ? "border-yellow-500/50 text-yellow-500"
                      : "border-muted-foreground/50"
                    }`}
                  >
                    {conv.status === "open" ? t.conversations.statusOpen : conv.status === "pending" ? t.conversations.statusPending : t.conversations.statusClosed}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold cursor-pointer hover:opacity-80 transition-colors ${
                          conv.kanban_column_id && kanbanColumns[conv.kanban_column_id]
                            ? ""
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        style={
                          conv.kanban_column_id && kanbanColumns[conv.kanban_column_id]
                            ? { borderColor: kanbanColumns[conv.kanban_column_id].color + "80", color: kanbanColumns[conv.kanban_column_id].color }
                            : undefined
                        }
                      >
                        {conv.kanban_column_id && kanbanColumns[conv.kanban_column_id]
                          ? kanbanColumns[conv.kanban_column_id].name
                          : "Sem etapa"}
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      {Object.entries(kanbanColumns).length === 0 ? (
                        <DropdownMenuItem disabled className="text-muted-foreground">
                          Nenhuma etapa cadastrada
                        </DropdownMenuItem>
                      ) : (
                        Object.entries(kanbanColumns).map(([id, col]) => (
                          <DropdownMenuItem
                            key={id}
                            onClick={async () => {
                              await updateKanban(conv.id, id);
                              await fetchConversations({ background: true });
                              toast.success(`Movido para ${col.name}`);
                            }}
                          >
                            <span className="h-2.5 w-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: col.color }} />
                            {col.name}
                          </DropdownMenuItem>
                        ))
                      )}

                      {conv.kanban_column_id && (
                        <DropdownMenuItem
                          onClick={async () => {
                            await updateKanban(conv.id, null);
                            await fetchConversations({ background: true });
                            toast.success("Etapa removida");
                          }}
                          className="text-muted-foreground"
                        >
                          <X className="h-3 w-3 mr-2" />
                          Remover etapa
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {conv.unread_count > 0 && (
                    <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center px-1">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
            <button className="md:hidden mr-1 text-muted-foreground" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {selectedConv.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{selectedConv.contact.name}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Phone className="h-2.5 w-2.5" /> {selectedConv.contact.phone}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs capitalize ${
                  selectedConv.status === "open" ? "border-green-500/50 text-green-500"
                  : selectedConv.status === "pending" ? "border-yellow-500/50 text-yellow-500"
                  : "border-muted-foreground/50"
                }`}
              >
                {selectedConv.status === "open" ? t.conversations.statusOpen : selectedConv.status === "pending" ? t.conversations.statusPending : t.conversations.statusClosed}
              </Badge>
              {/* Kanban Stage Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {selectedConv.kanban_column_id && kanbanColumns[selectedConv.kanban_column_id] ? (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:opacity-80"
                      style={{
                        borderColor: kanbanColumns[selectedConv.kanban_column_id].color + "80",
                        color: kanbanColumns[selectedConv.kanban_column_id].color,
                      }}
                    >
                      {kanbanColumns[selectedConv.kanban_column_id].name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                      Sem etapa
                    </Badge>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.entries(kanbanColumns).map(([id, col]) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={async () => {
                        await updateKanban(selectedConv.id, id);
                        toast.success(`Movido para ${col.name}`);
                      }}
                    >
                      <div className="h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: col.color }} />
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                  {selectedConv.kanban_column_id && (
                    <DropdownMenuItem
                      onClick={async () => {
                        await updateKanban(selectedConv.id, null);
                        toast.success("Etapa removida");
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-2" /> Remover etapa
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {selectedConv.status !== "open" && (
                    <DropdownMenuItem onClick={() => handleStatusChange(selectedConv.id, "open")}>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> {t.conversations.reopenConv}
                    </DropdownMenuItem>
                  )}
                  {selectedConv.status !== "pending" && (
                    <DropdownMenuItem onClick={() => handleStatusChange(selectedConv.id, "pending")}>
                      <Clock className="h-4 w-4 mr-2 text-yellow-500" /> {t.conversations.markPending}
                    </DropdownMenuItem>
                  )}
                  {selectedConv.status !== "closed" && (
                    <DropdownMenuItem onClick={() => handleStatusChange(selectedConv.id, "closed")}>
                      <XCircle className="h-4 w-4 mr-2 text-muted-foreground" /> {t.conversations.closeConv}
                    </DropdownMenuItem>
                   )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setClearConfirmId(selectedConv.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> {t.conversations.clearHistory}
                  </DropdownMenuItem>
                  {/* Transfer option - only show if multiple instances */}
                  {Object.keys(instanceNames).length > 1 && (
                    <DropdownMenuItem onClick={() => setTransferDialogOpen(true)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2 text-primary" /> Transferir instância
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={showDetails ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Schedule Info Banner */}
          {contactSchedules.length > 0 && (
            <div className="px-4 py-2 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2 mb-1.5">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs font-medium text-primary">
                  {contactSchedules.length === 1 ? "Próximo agendamento" : `${contactSchedules.length} agendamentos futuros`}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {contactSchedules.map((sch) => {
                  const dt = new Date(sch.scheduled_at);
                  const dateStr = dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
                  const timeStr = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
                  const isoDate = dt.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
                  return (
                    <div key={sch.id} className="flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-0.5 flex-1 min-w-0 truncate">
                        <Clock className="h-3 w-3 shrink-0" />
                        {dateStr} às {timeStr} — {sch.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        title="Remarcar"
                        onClick={() => setRescheduleData({ id: sch.id, date: isoDate, time: timeStr })}
                      >
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        title="Cancelar agendamento"
                        onClick={() => setCancelScheduleId(sch.id)}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">{t.conversations.noMessages}</p>
              </div>
            ) : (
              messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
            )}

            {/* AI Loading indicator */}


            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion */}
          <AnimatePresence>
            {aiSuggestion && (
              <AISuggestion
                suggestion={aiSuggestion}
                onSend={handleSendSuggestion}
                onDismiss={() => setAiSuggestion("")}
                sending={sendingSuggestion}
              />
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="border-t border-border p-3 bg-card">
            {selectedConv.status === "closed" ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t.conversations.conversationClosed}</span>
                <Button variant="outline" size="sm" onClick={() => handleStatusChange(selectedConv.id, "open")}>
                   {t.conversations.reopen}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={handleAIResponse}
                  disabled={aiLoading || messages.length === 0}
                  title="Gerar resposta com IA"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </Button>
                <Input
                  placeholder={messageLimitReached ? t.conversations.monthlyLimitReached : t.conversations.typeMessage}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  className="flex-1"
                  disabled={sending || messageLimitReached}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleSend()}
                  disabled={!newMessage.trim() || sending || messageLimitReached}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center text-muted-foreground">
          <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg">{t.conversations.selectConversation}</p>
        </div>
      )}

      {/* Contact Details Sidebar */}
      <AnimatePresence>
        {selectedConv && showDetails && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-80 border-l border-border bg-card flex flex-col hidden lg:flex"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Detalhes do Contato
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDetails(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-5">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Nome
                  </label>
                  <Input
                    value={detailsForm.name}
                    onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> E-mail
                  </label>
                  <Input
                    value={detailsForm.email}
                    onChange={(e) => setDetailsForm({ ...detailsForm, email: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="E-mail não informado"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3 w-3" /> CPF
                  </label>
                  <Input
                    value={detailsForm.cpf}
                    onChange={(e) => setDetailsForm({ ...detailsForm, cpf: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="CPF não informado"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> Tags (separadas por vírgula)
                  </label>
                  <Input
                    value={detailsForm.tags.join(", ")}
                    onChange={(e) => setDetailsForm({ ...detailsForm, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                    className="h-8 text-sm"
                    placeholder="ex: vip, novo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Notas / Observações
                  </label>
                  <textarea
                    value={detailsForm.notes}
                    onChange={(e) => setDetailsForm({ ...detailsForm, notes: e.target.value })}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Anote detalhes importantes aqui..."
                  />
                </div>

                <Button className="w-full h-9 gap-2" onClick={handleUpdateContact}>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </div>

              {/* Quick History/Stats could go here */}
              <div className="pt-4 border-t border-border">
                 <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Resumo</p>
                 <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span className="font-medium">{selectedConv.contact.phone}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] capitalize">{selectedConv.status}</Badge>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AlertDialog open={!!clearConfirmId} onOpenChange={(open) => !open && setClearConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.conversations.clearHistoryTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.conversations.clearHistoryDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (clearConfirmId) handleClearHistory(clearConfirmId);
                setClearConfirmId(null);
              }}
            >
              {t.conversations.clear}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Schedule Confirmation */}
      <AlertDialog open={!!cancelScheduleId} onOpenChange={(open) => !open && setCancelScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento será cancelado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelScheduleId) handleCancelSchedule(cancelScheduleId);
                setCancelScheduleId(null);
              }}
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <AlertDialog open={!!rescheduleData} onOpenChange={(open) => !open && setRescheduleData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remarcar agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Altere a data e/ou horário do agendamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rescheduleData && (
            <div className="flex gap-3 py-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
                <Input
                  type="date"
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Horário</label>
                <Input
                  type="time"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReschedule}>
              Remarcar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Instance Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Transferir conversa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Transferir esta conversa para outra instância WhatsApp conectada.
              {selectedConv?.instance_id && instanceNames[selectedConv.instance_id] && (
                <span className="block mt-1 text-foreground font-medium">
                  Instância atual: {instanceNames[selectedConv.instance_id]}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            {Object.entries(instanceNames)
              .filter(([id]) => id !== selectedConv?.instance_id)
              .map(([id, name]) => (
                <button
                  key={id}
                  onClick={async () => {
                    if (!selectedConv) return;
                    try {
                      const { data, error } = await supabase.functions.invoke("data-api", {
                        body: { _action: "conversations-transfer", conversation_id: selectedConv.id, to_instance_id: id },
                      });
                      if (error || !data?.success) {
                        toast.error(data?.error || "Erro ao transferir");
                      } else {
                        toast.success(`Conversa transferida para ${name}`);
                        fetchConversations({ background: true });
                      }
                    } catch {
                      toast.error("Erro ao transferir");
                    }
                    setTransferDialogOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">Clique para transferir</p>
                  </div>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
