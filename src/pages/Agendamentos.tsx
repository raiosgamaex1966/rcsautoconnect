import { useState, useEffect, useMemo } from "react";
import { useSchedules } from "@/hooks/useSchedules";
import { useServices, type Service } from "@/hooks/useServices";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useBlockedDates } from "@/hooks/useBlockedDates";
import { useReminders, type Reminder } from "@/hooks/useReminders";
import { useReminderLogs } from "@/hooks/useReminderLogs";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import {
  LayoutDashboard, Calendar, Store, Clock, Ban, Bell, AlertCircle,
  CheckCircle2, XCircle, Users, TrendingUp, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, Info, Eye, History, Send, RefreshCw, Filter, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const INTERVAL_OPTIONS = ["15 min", "30 min", "45 min", "1 hora", "1h30", "2 horas"];

function getWeekDates(baseDate: Date) {
  const day = baseDate.getDay();
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatScheduleTime(isoString: string, fmt: "time" | "datetime" | "short" = "datetime"): string {
  const d = new Date(isoString);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "America/Sao_Paulo" };
  if (fmt === "time") {
    return d.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" });
  }
  if (fmt === "short") {
    return d.toLocaleDateString("pt-BR", { ...opts, day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { ...opts, day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
    d.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" });
}

export default function Agendamentos() {
  const { t } = useLanguage();
  const { schedules: dbSchedules, loading: schedulesLoading, createSchedule, updateSchedule, updateScheduleStatus, deleteSchedule } = useSchedules();
  const { services, loading: svcLoading, createService, updateService, deleteService } = useServices();
  const { hours: businessHours, loading: hoursLoading, setHours: setBusinessHours, saveAll: saveBusinessHours } = useBusinessHours();
  const { blockedDates, loading: blocksLoading, addBlock, removeBlock } = useBlockedDates();
  const { reminders, loading: remindersLoading, toggleReminder: toggleReminderHook, updateReminder, createReminder, deleteReminder, setReminders } = useReminders();
  const { logs: reminderLogs, loading: logsLoading } = useReminderLogs();

  const tabItems = [
    { value: "dashboard", label: t.schedules.tabs.dashboard, icon: LayoutDashboard },
    { value: "agenda", label: t.schedules.tabs.agenda, icon: Calendar },
    { value: "servicos", label: t.schedules.tabs.services, icon: Store },
    { value: "horarios", label: t.schedules.tabs.hours, icon: Clock },
    { value: "bloqueios", label: t.schedules.tabs.blocks, icon: Ban },
    { value: "lembretes", label: t.schedules.tabs.reminders, icon: Bell },
  ];

  const [tab, setTab] = useState("dashboard");
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newDuration, setNewDuration] = useState("30");

  // Edit schedule state
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState("30");
  const [editStatus, setEditStatus] = useState<string>("pending");

  const openEditSchedule = (s: any) => {
    setEditingSchedule(s);
    setEditTitle(s.title);
    setEditDesc(s.description || "");
    const dt = new Date(s.scheduled_at);
    const spDate = dt.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const spTime = dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
    setEditDate(spDate);
    setEditTime(spTime);
    setEditDuration(String(s.duration_minutes || 30));
    setEditStatus(s.status);
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule || !editTitle.trim() || !editDate || !editTime) return;
    await updateSchedule(editingSchedule.id, {
      title: editTitle.trim(),
      description: editDesc || undefined,
      scheduled_at: `${editDate}T${editTime}:00-03:00`,
      duration_minutes: parseInt(editDuration) || 30,
      status: editStatus as any,
    });
    setEditingSchedule(null);
  };

  // Agenda
  const [agendaView, setAgendaView] = useState<"day" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDates = getWeekDates(currentDate);
  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (agendaView === "week" ? 7 * dir : dir));
    setCurrentDate(d);
  };
  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  // Computed metrics from real DB data
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
  const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd");

  const todayCount = dbSchedules.filter((s) => s.scheduled_at.startsWith(todayStr)).length;
  const tomorrowCount = dbSchedules.filter((s) => s.scheduled_at.startsWith(tomorrowStr)).length;
  const monthCount = dbSchedules.filter((s) => s.scheduled_at >= monthStart && s.scheduled_at <= monthEnd + "T23:59:59").length;

  const summaryCards = [
    { label: t.schedules.today, value: todayCount, sub: t.schedules.appointments, icon: Calendar },
    { label: t.schedules.tomorrow, value: tomorrowCount, sub: t.schedules.appointments, icon: Calendar },
    { label: t.schedules.thisMonth, value: monthCount, sub: t.schedules.appointments, icon: TrendingUp },
    { label: t.schedules.total, value: dbSchedules.length, sub: t.schedules.appointments, icon: Users },
  ];

  const statusCards = [
    { label: t.schedules.pending, value: dbSchedules.filter((s) => s.status === "pending").length, color: "text-yellow-500", icon: AlertCircle },
    { label: t.schedules.confirmed, value: dbSchedules.filter((s) => s.status === "confirmed").length, color: "text-blue-500", icon: Clock },
    { label: t.schedules.completed, value: dbSchedules.filter((s) => s.status === "completed").length, color: "text-green-500", icon: CheckCircle2 },
    { label: t.schedules.cancelled, value: dbSchedules.filter((s) => s.status === "cancelled").length, color: "text-destructive", icon: XCircle },
  ];

  const upcomingSchedules = dbSchedules
    .filter((s) => s.scheduled_at >= new Date().toISOString() && (s.status === "pending" || s.status === "confirmed"))
    .slice(0, 5);

  const handleCreateSchedule = async () => {
    if (!newTitle.trim() || !newDate || !newTime) return;
    const localDateTime = new Date(`${newDate}T${newTime}:00`);
    const scheduled_at = localDateTime.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T");
    await createSchedule({
      title: newTitle.trim(),
      description: newDesc || undefined,
      scheduled_at: `${newDate}T${newTime}:00-03:00`,
      duration_minutes: parseInt(newDuration) || 30,
    });
    setNewTitle(""); setNewDesc(""); setNewDate(""); setNewTime(""); setNewDuration("30");
    setShowNewScheduleModal(false);
  };

  // Service form state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcDuration, setSvcDuration] = useState("30");
  const [svcPrice, setSvcPrice] = useState("0");
  const [svcActive, setSvcActive] = useState(true);

  const resetServiceForm = () => {
    setSvcName(""); setSvcDesc(""); setSvcDuration("30"); setSvcPrice("0"); setSvcActive(true); setEditingService(null);
  };

  const handleSaveService = async () => {
    if (!svcName.trim()) return;
    const data = {
      name: svcName, description: svcDesc,
      duration_minutes: parseInt(svcDuration) || 30,
      price_cents: Math.round(parseFloat(svcPrice.replace(",", ".")) * 100) || 0,
      active: svcActive,
    };
    if (editingService) { await updateService(editingService.id, data); }
    else { await createService(data); }
    resetServiceForm(); setShowServiceModal(false);
  };

  const openEditService = (s: Service) => {
    setEditingService(s); setSvcName(s.name); setSvcDesc(s.description);
    setSvcDuration(String(s.duration_minutes)); setSvcPrice((s.price_cents / 100).toFixed(2).replace(".", ","));
    setSvcActive(s.active); setShowServiceModal(true);
  };

  // Business hours helpers
  const updateScheduleField = (idx: number, field: string, value: string | boolean) => {
    setBusinessHours((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const toggleDay = (idx: number) => {
    setBusinessHours((prev) => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
  };
  const useDefaultSchedule = () => {
    setBusinessHours((prev) => prev.map((s, i) => ({
      ...s, enabled: i >= 1 && i <= 5, open_time: "09:00", close_time: "18:00",
      break_start: "", break_end: "", interval_label: "30 min",
    })));
  };

  // Blocked dates
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const handleAddBlock = async () => {
    if (!blockDate) return;
    await addBlock(blockDate, blockReason);
    setBlockDate(""); setBlockReason(""); setShowBlockModal(false);
  };

  // Reminders
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showNewReminderModal, setShowNewReminderModal] = useState(false);
  const [previewReminder, setPreviewReminder] = useState<Reminder | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyReminderFilter, setHistoryReminderFilter] = useState("");
  const [resending, setResending] = useState<string | null>(null);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderOffset, setNewReminderOffset] = useState("60");
  const [newReminderUnit, setNewReminderUnit] = useState<"min" | "hours" | "days">("hours");
  const [newReminderMessage, setNewReminderMessage] = useState("Olá {nome}! Lembrando do seu agendamento de {servico} no dia {dia} às {hora}.");

  const handleSaveReminder = async () => {
    if (!editingReminder) return;
    await updateReminder(editingReminder);
    setEditingReminder(null);
  };

  const handleCreateNewReminder = async () => {
    if (!newReminderTitle.trim()) return;
    const rawOffset = parseInt(newReminderOffset) || 60;
    const offsetMinutes = newReminderUnit === "days" ? rawOffset * 1440 : newReminderUnit === "hours" ? rawOffset * 60 : rawOffset;
    const key = `custom_${Date.now()}`;
    await createReminder({
      reminder_key: key, title: newReminderTitle, description: formatOffsetLabel(offsetMinutes),
      enabled: true, message: newReminderMessage, offset_minutes: offsetMinutes,
    });
    setNewReminderTitle(""); setNewReminderOffset("60"); setNewReminderUnit("hours");
    setNewReminderMessage("Olá {nome}! Lembrando do seu agendamento de {servico} no dia {dia} às {hora}.");
    setShowNewReminderModal(false);
  };

  const formatOffsetLabel = (minutes: number): string => {
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      return `${days} ${days > 1 ? t.schedules.timeUnits.days : t.schedules.timeUnits.days.replace(/s$/, "")}`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}min` : `${hours} ${t.schedules.timeUnits.hours}`;
    }
    return `${minutes} ${t.schedules.timeUnits.minutes}`;
  };

  const variables = ["{nome}", "{servico}", "{data}", "{hora}", "{dia}"];

  const generatePreview = (message: string) => {
    const sampleDate = new Date();
    sampleDate.setDate(sampleDate.getDate() + 1);
    const dia = sampleDate.toLocaleDateString("pt-BR");
    const hora = sampleDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return message
      .replace(/\{nome\}/g, "Maria Silva")
      .replace(/\{servico\}/g, "Corte de Cabelo")
      .replace(/\{dia\}/g, dia)
      .replace(/\{data\}/g, dia)
      .replace(/\{hora\}/g, hora);
  };

  const filteredLogs = useMemo(() => {
    return reminderLogs.filter((log) => {
      const contact = (log.schedule as any)?.contact;
      const matchSearch = !historySearch || 
        (contact?.name || "").toLowerCase().includes(historySearch.toLowerCase()) ||
        (contact?.phone || "").includes(historySearch) ||
        ((log.schedule as any)?.title || "").toLowerCase().includes(historySearch.toLowerCase());
      const matchDate = !historyDateFilter || log.sent_at.startsWith(historyDateFilter);
      const matchReminder = !historyReminderFilter || log.reminder_key === historyReminderFilter;
      return matchSearch && matchDate && matchReminder;
    });
  }, [reminderLogs, historySearch, historyDateFilter, historyReminderFilter]);

  const handleResend = async (log: any) => {
    const schedule = log.schedule as any;
    if (!schedule?.title) { toast.error(t.common.error); return; }
    const matchedReminder = reminders.find((r) => r.reminder_key === log.reminder_key.replace("_resend", ""));
    if (!matchedReminder?.id) { toast.error(t.common.error); return; }
    setResending(log.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-reminder", {
        body: { schedule_id: log.schedule_id, reminder_id: matchedReminder.id },
      });
      if (error || !data?.success) {
        toast.error(data?.error || t.common.error);
      } else {
        toast.success(t.schedules.resent.replace("{contact}", data.data?.sent_to || ""));
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setResending(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t.schedules.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t.schedules.subtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-3 px-3 sm:-mx-6 sm:px-6">
          <TabsList className="bg-secondary w-max sm:w-full">
            {tabItems.map((ti) => (
              <TabsTrigger key={ti.value} value={ti.value} className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3 sm:flex-1">
                <ti.icon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">{ti.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {summaryCards.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-3 sm:py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-muted-foreground">{c.label}</p>
                    <c.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold mt-1">{c.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{c.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {statusCards.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                  <c.icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${c.color}`} />
                  <div className="min-w-0">
                    <p className={`text-lg sm:text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{c.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-base">{t.schedules.mostBooked}</CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t.schedules.popularityRanking}</p>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t.schedules.noServicesBooked}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-sm sm:text-base">{t.schedules.upcoming}</CardTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t.schedules.upcomingDesc}</p>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {upcomingSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-muted-foreground">
                    <Calendar className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                    <p className="text-sm">{t.schedules.noUpcoming}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingSchedules.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatScheduleTime(s.scheduled_at, "short")} • {s.duration_minutes || 30}min
                          </p>
                        </div>
                        <Badge variant={s.status === "confirmed" ? "default" : "outline"} className="text-[10px] capitalize shrink-0">
                          {s.status === "pending" ? t.schedules.pending : t.schedules.confirmed}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AGENDA */}
        <TabsContent value="agenda" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:py-6 space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                    <h2 className="text-base sm:text-xl font-bold">{t.schedules.agenda}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex border border-border rounded-lg overflow-hidden">
                      <button className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm flex items-center gap-1 ${agendaView === "day" ? "bg-secondary" : ""}`} onClick={() => setAgendaView("day")}>
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t.schedules.day}
                      </button>
                      <button className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm flex items-center gap-1 ${agendaView === "week" ? "bg-secondary" : ""}`} onClick={() => setAgendaView("week")}>
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t.schedules.week}
                      </button>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs w-fit">{formatDateBR(currentDate)}</Badge>
              </div>

              <div className="flex flex-col-reverse lg:flex-row gap-4">
                <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigateWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigateWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8" onClick={() => setCurrentDate(new Date())}>{t.schedules.todayBtn}</Button>
                    </div>
                    <Button size="sm" className="text-xs gap-1" onClick={() => setShowNewScheduleModal(true)}>
                      <Plus className="h-3.5 w-3.5" /> {t.schedules.newSchedule}
                    </Button>
                  </div>
                  {agendaView === "week" ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 sm:gap-2">
                      {weekDates.map((d, i) => {
                        const dayStr = format(d, "yyyy-MM-dd");
                        const daySchedules = dbSchedules.filter((s) => s.scheduled_at.startsWith(dayStr));
                        return (
                          <div
                            key={i}
                            className={`rounded-lg border p-2 sm:p-3 min-h-[80px] sm:min-h-[120px] text-center cursor-pointer transition-colors hover:border-primary/50 ${isToday(d) ? "border-primary bg-primary/5" : "border-border"}`}
                            onClick={() => { setCurrentDate(d); setAgendaView("day"); }}
                          >
                            <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">{t.schedules.weekdaysShort[d.getDay()]}</p>
                            <p className={`text-lg sm:text-2xl font-bold ${isToday(d) ? "text-primary" : ""}`}>{d.getDate().toString().padStart(2, "0")}</p>
                            {daySchedules.length > 0 && (
                              <Badge variant="default" className="text-[9px] mt-1">{daySchedules.length}</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border p-4 sm:p-6 min-h-[200px] sm:min-h-[300px]">
                      <p className="text-sm sm:text-lg font-semibold mb-3">{t.schedules.weekdaysUpper[currentDate.getDay()]} - {currentDate.getDate().toString().padStart(2, "0")}</p>
                      {(() => {
                        const dayStr = format(currentDate, "yyyy-MM-dd");
                        const daySchedules = dbSchedules.filter((s) => s.scheduled_at.startsWith(dayStr));
                        if (daySchedules.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                              <Calendar className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                              <p className="text-sm">{t.schedules.noSchedulesDay}</p>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            {daySchedules.map((s) => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{s.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatScheduleTime(s.scheduled_at, "time")} • {s.duration_minutes || 30}min
                                    {s.contact?.name && ` • ${s.contact.name}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <select
                                    value={s.status}
                                    onChange={(e) => updateScheduleStatus(s.id, e.target.value as any)}
                                    className="h-7 text-xs rounded-md border border-border bg-background px-2 cursor-pointer"
                                  >
                                    <option value="pending">{t.schedules.pending}</option>
                                    <option value="confirmed">{t.schedules.confirmed}</option>
                                    <option value="completed">{t.schedules.completed}</option>
                                    <option value="cancelled">{t.schedules.cancelled}</option>
                                  </select>
                                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEditSchedule(s)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSchedule(s.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex justify-center lg:justify-start">
                  <CalendarPicker
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => { if (date) setCurrentDate(date); }}
                    className="rounded-lg border border-border pointer-events-auto"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SERVIÇOS */}
        <TabsContent value="servicos" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 sm:h-5 sm:w-5" />
                    <h2 className="text-base sm:text-xl font-bold">{t.schedules.services}</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t.schedules.servicesDesc}</p>
                </div>
                <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto text-xs sm:text-sm" onClick={() => { resetServiceForm(); setShowServiceModal(true); }}>
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> {t.schedules.newService}
                </Button>
              </div>
              {services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-muted-foreground">
                  <Store className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                  <p className="font-medium text-sm">{t.schedules.noServices}</p>
                  <p className="text-xs sm:text-sm mt-1">{t.schedules.noServicesDesc}</p>
                  <Button variant="outline" className="mt-4 text-xs sm:text-sm" onClick={() => { resetServiceForm(); setShowServiceModal(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> {t.schedules.addService}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {services.map((s) => (
                    <div key={s.id} className={`flex items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg border border-border gap-2 ${!s.active ? "opacity-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          {!s.active && <Badge variant="outline" className="text-[10px]">{t.schedules.inactive}</Badge>}
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>}
                        <p className="text-xs text-muted-foreground">{s.duration_minutes} min • R$ {(s.price_cents / 100).toFixed(2).replace(".", ",")}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditService(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteService(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HORÁRIOS */}
        <TabsContent value="horarios" className="mt-4 sm:mt-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h2 className="text-base sm:text-xl font-bold">{t.schedules.businessHours}</h2>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t.schedules.businessHoursDesc}</p>
              </div>
              <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto text-xs sm:text-sm" onClick={useDefaultSchedule}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> {t.schedules.defaultSchedule}
              </Button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {businessHours.map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-3 sm:py-4">
                    {!s.enabled ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Switch checked={s.enabled} onCheckedChange={() => toggleDay(i)} />
                          <span className="font-medium text-sm">{s.day_name}</span>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => toggleDay(i)}>
                          <Plus className="h-3 w-3 mr-1" /> {t.schedules.configure}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Switch checked={s.enabled} onCheckedChange={() => toggleDay(i)} />
                          <span className="font-bold text-sm">{s.day_name}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] sm:text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t.schedules.opening}</Label>
                            <Input type="time" value={s.open_time} onChange={(e) => updateScheduleField(i, "open_time", e.target.value)} className="h-8 sm:h-9 text-xs sm:text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] sm:text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t.schedules.closing}</Label>
                            <Input type="time" value={s.close_time} onChange={(e) => updateScheduleField(i, "close_time", e.target.value)} className="h-8 sm:h-9 text-xs sm:text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] sm:text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t.schedules.breakStart}</Label>
                            <Input type="time" value={s.break_start} onChange={(e) => updateScheduleField(i, "break_start", e.target.value)} placeholder="--:--" className="h-8 sm:h-9 text-xs sm:text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] sm:text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t.schedules.breakEnd}</Label>
                            <Input type="time" value={s.break_end} onChange={(e) => updateScheduleField(i, "break_end", e.target.value)} placeholder="--:--" className="h-8 sm:h-9 text-xs sm:text-sm" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] sm:text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t.schedules.intervalBetween}</Label>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {INTERVAL_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm rounded-md border transition-colors ${s.interval_label === opt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
                                onClick={() => updateScheduleField(i, "interval_label", opt)}
                              >{opt}</button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button className="bg-primary hover:bg-primary/90 text-xs sm:text-sm" size="sm" onClick={() => saveBusinessHours(businessHours)}>{t.common.save}</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* BLOQUEIOS */}
        <TabsContent value="bloqueios" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                    <h2 className="text-base sm:text-xl font-bold">{t.schedules.blockedDates}</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t.schedules.blockedDatesSubtitle}</p>
                </div>
                <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto text-xs sm:text-sm" onClick={() => setShowBlockModal(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> {t.schedules.blockDateButton}
                </Button>
              </div>
              {blockedDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-muted-foreground">
                  <Ban className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                  <p className="font-medium text-sm">{t.schedules.noBlocks}</p>
                  <p className="text-xs sm:text-sm mt-1">{t.schedules.noBlocksHint}</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {blockedDates.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg border border-border gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{new Date(b.blocked_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.reason || t.schedules.noReason}</p>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeBlock(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEMBRETES */}
        <TabsContent value="lembretes" className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 sm:gap-3">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5" />
              <div>
                <h2 className="text-base sm:text-xl font-bold">{t.schedules.reminders}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t.schedules.remindersSubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none text-xs sm:text-sm" onClick={() => setShowHistoryModal(true)}>
                <History className="h-3.5 w-3.5 mr-1.5" /> {t.schedules.history}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none text-xs sm:text-sm" onClick={() => setShowNewReminderModal(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> {t.schedules.newReminder}
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-3 sm:py-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{t.schedules.variablesInMessage}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                {variables.map((v) => (<Badge key={v} variant="outline" className="font-mono text-[10px] sm:text-xs">{v}</Badge>))}
              </div>
            </CardContent>
          </Card>
          {reminders.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-10">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Bell className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                  <p className="font-medium text-sm">{t.schedules.noReminders}</p>
                  <p className="text-xs sm:text-sm mt-1">{t.schedules.noRemindersHint}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            reminders.map((r) => (
              <Card key={r.id || r.reminder_key}>
                <CardContent className="p-3 sm:py-4">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{r.title}</p>
                          <Badge variant="outline" className="text-[10px]">{formatOffsetLabel(r.offset_minutes)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.message}</p>
                      </div>
                    </div>
                    <Switch checked={r.enabled} onCheckedChange={() => toggleReminderHook(r.reminder_key)} />
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-2 sm:mt-3">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs" onClick={() => setPreviewReminder(r)}>
                      <Eye className="h-3 w-3 mr-1" /> {t.schedules.preview}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs" onClick={() => setEditingReminder({ ...r })}>
                      <Pencil className="h-3 w-3 mr-1" /> {t.common.edit}
                    </Button>
                    {r.id && (
                      <Button variant="outline" size="sm" className="h-7 sm:h-8 text-[10px] sm:text-xs text-destructive hover:text-destructive" onClick={() => r.id && deleteReminder(r.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> {t.common.delete}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Service Modal */}
      <Dialog open={showServiceModal} onOpenChange={setShowServiceModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingService ? t.schedules.serviceModal.editTitle : t.schedules.serviceModal.title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs sm:text-sm text-muted-foreground">{t.schedules.fillServiceData}</p>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.serviceModal.name} *</Label>
              <Input placeholder="Ex: Corte de Cabelo" value={svcName} onChange={(e) => setSvcName(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.serviceModal.description}</Label>
              <Textarea placeholder="" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.serviceModal.duration} *</Label>
                <Input type="number" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} min="5" step="5" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.serviceModal.price}</Label>
                <Input placeholder="0,00" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium">{t.schedules.serviceActiveLabel}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t.schedules.inactiveNotShown}</p>
              </div>
              <Switch checked={svcActive} onCheckedChange={setSvcActive} />
            </div>
            <div className="flex justify-end gap-2 sm:gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowServiceModal(false)}>{t.common.cancel}</Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleSaveService} disabled={!svcName.trim()}>
                {editingService ? t.common.save : t.schedules.createSchedule}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Date Modal */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{t.schedules.blockModal.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.blockModal.date}</Label>
              <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.blockModal.reason}</Label>
              <Input placeholder="" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="text-sm" />
            </div>
            <div className="flex justify-end gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowBlockModal(false)}>{t.common.cancel}</Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleAddBlock} disabled={!blockDate}>{t.schedules.blockModal.block}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Reminder Modal */}
      <Dialog open={!!editingReminder} onOpenChange={() => setEditingReminder(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{t.schedules.editReminder}</DialogTitle></DialogHeader>
          {editingReminder && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.scheduleTitle}</Label>
                <Input value={editingReminder.title} onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.offsetMinutesLabel}</Label>
                <Input type="number" min="1" value={editingReminder.offset_minutes} onChange={(e) => setEditingReminder({ ...editingReminder, offset_minutes: parseInt(e.target.value) || 60 })} className="text-sm" />
                <p className="text-[10px] text-muted-foreground">{t.schedules.offsetExample}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.message}</Label>
                <Textarea rows={3} value={editingReminder.message} onChange={(e) => setEditingReminder({ ...editingReminder, message: e.target.value })} className="text-sm" />
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {variables.map((v) => (
                  <Badge key={v} variant="outline" className="font-mono text-[10px] sm:text-xs cursor-pointer hover:bg-secondary"
                    onClick={() => setEditingReminder({ ...editingReminder, message: editingReminder.message + " " + v })}
                  >{v}</Badge>
                ))}
              </div>
              <div className="flex justify-end gap-2 sm:gap-3">
                <Button variant="outline" size="sm" onClick={() => setEditingReminder(null)}>{t.common.cancel}</Button>
                <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleSaveReminder}>{t.common.save}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Reminder Modal */}
      <Dialog open={showNewReminderModal} onOpenChange={setShowNewReminderModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{t.schedules.newReminder}</DialogTitle></DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.reminderName} *</Label>
              <Input placeholder="" value={newReminderTitle} onChange={(e) => setNewReminderTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.sendBefore} *</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" value={newReminderOffset} onChange={(e) => setNewReminderOffset(e.target.value)} className="text-sm flex-1" />
                <select
                  className="text-sm border rounded-md px-3 py-2 bg-background"
                  value={newReminderUnit}
                  onChange={(e) => setNewReminderUnit(e.target.value as "min" | "hours" | "days")}
                >
                  <option value="min">{t.schedules.timeUnits.minutes}</option>
                  <option value="hours">{t.schedules.timeUnits.hours}</option>
                  <option value="days">{t.schedules.timeUnits.days}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.message}</Label>
              <Textarea rows={3} value={newReminderMessage} onChange={(e) => setNewReminderMessage(e.target.value)} className="text-sm" />
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {variables.map((v) => (
                <Badge key={v} variant="outline" className="font-mono text-[10px] sm:text-xs cursor-pointer hover:bg-secondary"
                  onClick={() => setNewReminderMessage((prev) => prev + " " + v)}
                >{v}</Badge>
              ))}
            </div>
            <div className="flex justify-end gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowNewReminderModal(false)}>{t.common.cancel}</Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleCreateNewReminder} disabled={!newReminderTitle.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t.schedules.createReminder}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Schedule Modal */}
      <Dialog open={showNewScheduleModal} onOpenChange={setShowNewScheduleModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{t.schedules.newScheduleTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.scheduleTitle}</Label>
              <Input placeholder="" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.description}</Label>
              <Textarea rows={2} placeholder="" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.date}</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.time}</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.duration}</Label>
              <Input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className="text-sm" />
            </div>
            <div className="flex justify-end gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowNewScheduleModal(false)}>{t.common.cancel}</Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleCreateSchedule} disabled={!newTitle.trim() || !newDate || !newTime}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t.schedules.createSchedule}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => { if (!open) setEditingSchedule(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">Editar Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.scheduleTitle}</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t.schedules.description}</Label>
              <Textarea rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.date}</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.time}</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{t.schedules.duration}</Label>
                <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">Status</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="h-9 w-full text-sm rounded-md border border-border bg-background px-3"
                >
                  <option value="pending">{t.schedules.pending}</option>
                  <option value="confirmed">{t.schedules.confirmed}</option>
                  <option value="completed">{t.schedules.completed}</option>
                  <option value="cancelled">{t.schedules.cancelled}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => setEditingSchedule(null)}>{t.common.cancel}</Button>
              <Button className="bg-primary hover:bg-primary/90" size="sm" onClick={handleSaveEdit} disabled={!editTitle.trim() || !editDate || !editTime}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Reminder Modal */}
      <Dialog open={!!previewReminder} onOpenChange={() => setPreviewReminder(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">{t.schedules.previewTitle}</DialogTitle></DialogHeader>
          {previewReminder && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{previewReminder.title}</Badge>
                <Badge variant="secondary" className="text-xs">{formatOffsetLabel(previewReminder.offset_minutes)}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t.schedules.originalTemplate}</p>
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm whitespace-pre-wrap">
                  {previewReminder.message}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Eye className="h-3 w-3" /> {t.schedules.clientExample}
                </p>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-sm whitespace-pre-wrap">
                  {generatePreview(previewReminder.message)}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.schedules.sampleDataNote}</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setPreviewReminder(null)}>{t.schedules.close}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={(open) => { setShowHistoryModal(open); if (!open) { setHistorySearch(""); setHistoryDateFilter(""); setHistoryReminderFilter(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <History className="h-4 w-4" /> {t.schedules.historyTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t.schedules.searchHistory}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="text-xs sm:text-sm pl-8 h-9"
              />
            </div>
            <Input
              type="date"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              className="text-xs sm:text-sm h-9 w-full sm:w-40"
            />
            <select
              className="text-xs sm:text-sm border rounded-md px-3 h-9 bg-background w-full sm:w-44"
              value={historyReminderFilter}
              onChange={(e) => setHistoryReminderFilter(e.target.value)}
            >
              <option value="">{t.schedules.allReminders}</option>
              {reminders.map((r) => (
                <option key={r.reminder_key} value={r.reminder_key}>{r.title}</option>
              ))}
            </select>
          </div>

          <div className="overflow-auto flex-1">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">{t.common.loading}</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {reminderLogs.length === 0 ? t.schedules.noHistory : t.schedules.noResultsFound}
                </p>
                <p className="text-xs mt-1">
                  {reminderLogs.length === 0 ? t.schedules.logsWillAppear : t.schedules.adjustFilters}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t.schedules.historyTable.contact}</TableHead>
                    <TableHead className="text-xs">{t.schedules.historyTable.schedule}</TableHead>
                    <TableHead className="text-xs">{t.schedules.historyTable.reminder}</TableHead>
                    <TableHead className="text-xs">{t.schedules.historyTable.sentAt}</TableHead>
                    <TableHead className="text-xs w-20">{t.schedules.historyTable.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const matchedReminder = reminders.find((r) => r.reminder_key === log.reminder_key || r.reminder_key === log.reminder_key.replace("_resend", ""));
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          <div>
                            <p className="font-medium">{(log.schedule as any)?.contact?.name || "—"}</p>
                            <p className="text-muted-foreground">{(log.schedule as any)?.contact?.phone || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <p className="font-medium">{(log.schedule as any)?.title || "—"}</p>
                            <p className="text-muted-foreground">
                              {(log.schedule as any)?.scheduled_at
                                ? formatScheduleTime((log.schedule as any).scheduled_at)
                                : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-[10px] w-fit">
                              {matchedReminder?.title || log.reminder_key}
                            </Badge>
                            {log.reminder_key.includes("_resend") && (
                              <Badge variant="secondary" className="text-[10px] w-fit">{t.schedules.resendBadge}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="sm" className="h-7 text-[10px]"
                            disabled={resending === log.id}
                            onClick={() => handleResend(log)}
                          >
                            {resending === log.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                            {t.schedules.resend}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
