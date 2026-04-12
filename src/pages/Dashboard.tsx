import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  MessageCircle,
  Bot,
  Users,
  Clock,
  Calendar,
  ChevronRight,
  Smartphone,
  Loader2,
  Sparkles,
  User,
  TrendingUp,
  Download,
  Crown,
  HardDrive,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useDashboardMetrics, type PeriodFilter } from "@/hooks/useDashboardMetrics";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAISettings } from "@/hooks/useAISettings";
import { supabase } from "@/integrations/supabase/client";
import { exportDashboardCsv } from "@/utils/exportDashboardCsv";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { metrics, loading, period, setPeriod, chartData } = useDashboardMetrics();
  const { plan, usage, subscription, hasPlan, trialBlocked, isAdmin, loading: planLoading, getUsagePercent } = usePlanLimits();
  const { settings: aiSettings, update: updateAI, save: saveAI, loading: aiLoading, saving: aiSaving } = useAISettings();

  const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: "today", label: t.dashboard.periods.today },
    { value: "7d", label: t.dashboard.periods["7d"] },
    { value: "30d", label: t.dashboard.periods["30d"] },
    { value: "all", label: t.dashboard.periods.all },
  ];

  const setupStepsDef = [
    { key: "whatsapp", label: t.dashboard.setupSteps.whatsapp.label, action: t.dashboard.setupSteps.whatsapp.action, path: "/whatsapp" },
    { key: "business", label: t.dashboard.setupSteps.business.label, action: t.dashboard.setupSteps.business.action, path: "/configuracoes" },
    { key: "document", label: t.dashboard.setupSteps.document.label, action: t.dashboard.setupSteps.document.action, path: "/configuracoes" },
    { key: "ai", label: t.dashboard.setupSteps.ai.label, action: t.dashboard.setupSteps.ai.action, path: "/configuracoes" },
  ];

  // Dynamic setup checklist
  const [setupDone, setSetupDone] = useState<Record<string, boolean>>({
    whatsapp: false, business: false, document: false, ai: false,
  });

  useEffect(() => {
    if (!user) return;
    const checkSetup = async () => {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "dashboard-setup-check" },
      });
      if (!error && data?.success) {
        setSetupDone(data.data);
      }
    };
    checkSetup();
  }, [user]);

  const completedSteps = Object.values(setupDone).filter(Boolean).length;
  const totalSteps = setupStepsDef.length;

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  const stats = [
    { label: t.dashboard.stats.totalConversations, value: String(metrics.totalConversations || 0), icon: MessageCircle },
    { label: t.dashboard.stats.inboundMessages, value: String(metrics.inboundMessages || 0), icon: Bot },
    { label: t.dashboard.stats.outboundMessages, value: String(metrics.outboundMessages || 0), icon: Users },
    { label: t.dashboard.stats.contacts, value: String(metrics.totalContacts || 0), icon: Users },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.hello.replace("{name}", displayName)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportDashboardCsv(metrics, chartData, period)}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t.dashboard.exportCsv}</span>
          </Button>
          <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
            {periodOptions.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trial / Free plan banner */}
      {!isAdmin && trialBlocked && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="flex items-center justify-between py-3 sm:py-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm">{t.dashboard.trialDisabled}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {t.dashboard.trialDisabledDesc}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0 font-semibold"
              onClick={() => navigate("/planos")}
            >
              {t.dashboard.upgrade}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isAdmin && !trialBlocked && hasPlan && plan && plan.price_cents === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3 sm:py-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm">
                  {subscription?.status === "trial"
                    ? t.dashboard.trialBanner
                    : t.dashboard.freeBanner}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {subscription?.status === "trial" && subscription?.trial_ends_at
                    ? t.dashboard.trialDaysLeft.replace("{count}", String(Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))))
                    : t.dashboard.upgradeDesc}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-primary hover:bg-primary/90 font-semibold"
              onClick={() => navigate("/planos")}
            >
              {t.dashboard.subscribe}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Card */}
      {completedSteps < totalSteps && (
        <div>
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-center mb-3 sm:mb-4">
                  <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold text-sm sm:text-base">{t.dashboard.completeSetup}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t.dashboard.completeSetupDesc}
                  </p>
                </div>
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                    {completedSteps}/{totalSteps}
                  </span>
                  <Progress value={(completedSteps / totalSteps) * 100} className="flex-1" />
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {setupStepsDef.map((step) => (
                    <div
                      key={step.key}
                      className="flex items-center justify-between py-1.5 sm:py-2"
                      style={{ opacity: setupDone[step.key] ? 0.6 : 1, transform: setupDone[step.key] ? "scale(0.98)" : "scale(1)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${setupDone[step.key] ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className={`text-xs sm:text-sm truncate ${setupDone[step.key] ? "line-through text-muted-foreground" : ""}`}>{step.label}</span>
                      </div>
                      {!setupDone[step.key] && (
                        <button
                          className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                          onClick={() => navigate(step.path)}
                        >
                          {step.action} <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
        </div>
      )}

      {/* AI Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm">
                {aiSettings.ai_enabled ? t.dashboard.aiResponding : t.dashboard.aiActive}
              </h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {aiSettings.ai_enabled
                  ? t.dashboard.aiRespondingDesc
                  : t.dashboard.aiPausedDesc}
              </p>
            </div>
          </div>
          <Switch
            checked={aiSettings.ai_enabled}
            disabled={aiSaving}
            onCheckedChange={async (v) => {
              updateAI({ ai_enabled: v });
              const ok = await saveAI({ ai_enabled: v });
              if (!ok) {
                updateAI({ ai_enabled: !v });
                toast.error(t.dashboard.aiToggleError);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Plan Usage Card */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> {t.dashboard.planUsage}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {plan?.name || "..."}
              </Badge>
              {subscription?.status === "trial" && (
                <Badge variant="secondary" className="text-xs">
                  Trial
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3 sm:pb-4 space-y-3">
          {([
            {
              label: t.dashboard.whatsappInstances,
              icon: Smartphone,
              used: usage?.instances || 0,
              max: plan?.max_instances || 0,
              key: "instances" as const,
            },
            {
              label: t.dashboard.monthlyMessages,
              icon: MessageCircle,
              used: usage?.messages_this_month || 0,
              max: plan?.max_messages || 0,
              key: "messages" as const,
            },
            {
              label: t.dashboard.storage,
              icon: HardDrive,
              used: usage?.storage_mb || 0,
              max: plan?.storage_mb || 0,
              key: "storage" as const,
              suffix: "MB",
            },
          ] as { label: string; icon: any; used: number; max: number | null; key: "instances" | "messages" | "storage"; suffix?: string }[]).map((item) => {
            const percent = !plan || item.max === null ? 0 : getUsagePercent(item.key);
            const isUnlimited = item.max === null;
            const isNearLimit = percent >= 80;
            const isAtLimit = percent >= 100;
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className={`font-medium ${isAtLimit ? "text-destructive" : isNearLimit ? "text-yellow-500" : "text-foreground"}`}>
                    {item.used}{item.suffix ? ` ${item.suffix}` : ""}
                    {" / "}
                    {isUnlimited ? "∞" : `${item.max}${item.suffix ? ` ${item.suffix}` : ""}`}
                  </span>
                </div>
                {!isUnlimited && (
                  <Progress
                    value={Math.min(percent, 100)}
                    className={`h-1.5 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`}
                  />
                )}
              </div>
            );
          })}
          <div className="pt-1">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate("/planos")}>
              {plan?.price_cents === 0 ? t.dashboard.upgrade : t.dashboard.managePlan}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Messages Timeline Chart */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> {t.dashboard.messagesEvolution}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 sm:pb-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="inbound" name={t.dashboard.received} stroke="hsl(var(--primary))" fill="url(#colorInbound)" strokeWidth={2} />
                <Area type="monotone" dataKey="ai" name={t.dashboard.ai} stroke="hsl(142, 71%, 45%)" fill="url(#colorAi)" strokeWidth={2} />
                <Area type="monotone" dataKey="manual" name={t.dashboard.manual} stroke="hsl(var(--muted-foreground))" fill="url(#colorManual)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{t.dashboard.noDataPeriod}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {t.dashboard.aiVsManual}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 sm:pb-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{loading ? "..." : metrics.aiMessages}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t.dashboard.aiResponses}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-secondary border border-border">
              <User className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{loading ? "..." : metrics.manualMessages}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t.dashboard.manualResponses}</p>
              </div>
            </div>
          </div>
          {!loading && (metrics.aiMessages + metrics.manualMessages) > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t.dashboard.ai}: {Math.round((metrics.aiMessages / (metrics.aiMessages + metrics.manualMessages)) * 100)}%</span>
                <span>{t.dashboard.manual}: {Math.round((metrics.manualMessages / (metrics.aiMessages + metrics.manualMessages)) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                <div
                  className="h-full bg-primary rounded-l-full transition-all"
                  style={{ width: `${(metrics.aiMessages / (metrics.aiMessages + metrics.manualMessages)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extra metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold">{loading ? "..." : metrics.activeInstances}</p>
                <p className="text-xs text-muted-foreground">{t.dashboard.connectedInstances}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold">{loading ? "..." : metrics.pendingSchedules}</p>
                <p className="text-xs text-muted-foreground">{t.dashboard.pendingSchedules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View all conversations */}
      <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/conversas")}>
        <CardContent className="flex items-center justify-between py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm">{t.dashboard.viewAllConversations}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {t.dashboard.viewAllConversationsDesc}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </div>
  );
}
