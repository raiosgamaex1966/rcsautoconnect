import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CreditCard, Smartphone, MessageCircle, Activity, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeUp } from "./AdminHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminMetrics {
  totalUsers: number; totalInstances: number; connectedInstances: number;
  totalMessages: number; messages24h: number; totalConversations: number;
  monthlyRevenueCents: number; subscriptionsByStatus: Record<string, number>;
}

export default function MetricsTab() {
  const { t } = useLanguage();
  const m = t.admin.metrics;
  const [data, setData] = useState<AdminMetrics | null>(() => {
    const cached = localStorage.getItem("rcs_admin_metrics");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      // setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke("admin-data?action=metrics");
        if (error) throw error;
        if (res?.success) {
          setData(res.data);
          localStorage.setItem("rcs_admin_metrics", JSON.stringify(res.data));
        }
      } catch { console.error("Error fetching admin metrics"); }
      setLoading(false);
    };
    fetch();
  }, []);

  // Silent loading
  if (!data) return null;

  const formatCurrency = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
  const uptimePercent = data.totalInstances > 0 ? ((data.connectedInstances / data.totalInstances) * 100).toFixed(1) : "0";

  const metrics = [
    { label: m.registeredUsers, value: String(data.totalUsers), icon: Users },
    { label: m.messages24h, value: data.messages24h.toLocaleString(), icon: MessageCircle },
    { label: m.onlineInstances, value: `${data.connectedInstances}/${data.totalInstances}`, icon: Smartphone },
    { label: m.monthlyRevenue, value: formatCurrency(data.monthlyRevenueCents), icon: CreditCard },
    { label: m.totalConversations, value: data.totalConversations.toLocaleString(), icon: Activity },
    { label: m.uptimeRate, value: `${uptimePercent}%`, icon: TrendingUp },
  ];

  const subStatuses = Object.entries(data.subscriptionsByStatus || {});

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {metrics.map((met, i) => (
          <div key={met.label}>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <met.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold mt-3">{met.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">{met.label}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {subStatuses.length > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base">{m.subscriptionsByStatus}</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {subStatuses.map(([status, count]) => (
                <div key={status} className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base">{m.generalSummary}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-lg font-bold">{data.totalMessages.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{m.totalMessages}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-lg font-bold">{data.totalInstances}</p>
              <p className="text-xs text-muted-foreground">{m.totalInstances}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
