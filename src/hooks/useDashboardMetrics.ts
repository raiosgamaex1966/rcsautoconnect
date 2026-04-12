import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PeriodFilter = "today" | "7d" | "30d" | "all";

export interface DashboardMetrics {
  totalConversations: number;
  totalMessages: number;
  activeInstances: number;
  totalContacts: number;
  pendingSchedules: number;
  inboundMessages: number;
  outboundMessages: number;
  aiMessages: number;
  manualMessages: number;
}

export interface ChartDataPoint {
  date: string;
  inbound: number;
  ai: number;
  manual: number;
}

function getStartDate(period: PeriodFilter): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    now.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString();
}

export function useDashboardMetrics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => {
    const cached = localStorage.getItem("zapmax_dashboard_metrics");
    return cached ? JSON.parse(cached) : {
      totalConversations: 0, totalMessages: 0, activeInstances: 0,
      totalContacts: 0, pendingSchedules: 0, inboundMessages: 0,
      outboundMessages: 0, aiMessages: 0, manualMessages: 0,
    };
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => {
    const cached = localStorage.getItem("zapmax_dashboard_chart");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    if (!user) return;
    // setLoading(true);

    const startDate = getStartDate(period);
    const chartDays = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 14;

    const { data, error } = await supabase.functions.invoke("data-api", {
      body: {
        _action: "dashboard-metrics",
        start_date: startDate,
        chart_days: chartDays,
      },
    });

    if (!error && data?.success) {
      setMetrics(data.data.metrics);
      setChartData(data.data.chartData || []);
      localStorage.setItem("zapmax_dashboard_metrics", JSON.stringify(data.data.metrics));
      localStorage.setItem("zapmax_dashboard_chart", JSON.stringify(data.data.chartData || []));
    }

    setLoading(false);
  }, [user, period]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // Realtime refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchMetrics())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMetrics]);

  return { metrics, loading, period, setPeriod, chartData, refetch: fetchMetrics };
}
