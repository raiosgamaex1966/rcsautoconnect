import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanLimits {
  max_instances: number;
  max_messages: number | null;
  max_bots: number;
  max_users: number;
  storage_mb: number;
}

export interface PlanUsage {
  instances: number;
  members: number;
  messages_this_month: number;
  bots: number;
  storage_mb: number;
}

export interface PlanInfo {
  id: string;
  name: string;
  price_cents: number;
  max_instances: number;
  max_messages: number | null;
  max_bots: number;
  max_users: number;
  storage_mb: number;
  support_level: string;
}

export interface SubscriptionInfo {
  id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export function usePlanLimits() {
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(false);
  const [hasPlan, setHasPlan] = useState(() => localStorage.getItem("zapmax_has_plan") === "true");
  const [plan, setPlan] = useState<PlanInfo | null>(() => {
    const cached = localStorage.getItem("zapmax_plan_info");
    return cached ? JSON.parse(cached) : null;
  });
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(() => {
    const cached = localStorage.getItem("zapmax_subscription_info");
    return cached ? JSON.parse(cached) : null;
  });
  const [usage, setUsage] = useState<PlanUsage | null>(() => {
    const cached = localStorage.getItem("zapmax_plan_usage");
    return cached ? JSON.parse(cached) : null;
  });
  const [trialBlocked, setTrialBlocked] = useState(() => localStorage.getItem("zapmax_trial_blocked") === "true");
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(() => {
    const cached = localStorage.getItem("zapmax_trial_days_left");
    return cached ? parseInt(cached) : null;
  });
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("zapmax_is_admin_plan") === "true");
  const fetchedRef = useRef<string | null>(null);

  const applyData = (data: any) => {
    setHasPlan(data.has_plan);
    setPlan(data.plan || null);
    setSubscription(data.subscription || null);
    setUsage(data.usage || null);
    setTrialBlocked(!!data.trial_blocked);
    setTrialDaysLeft(data.trial_days_left ?? null);
    setIsAdmin(!!data.is_admin);

    localStorage.setItem("zapmax_has_plan", String(data.has_plan));
    if (data.plan) localStorage.setItem("zapmax_plan_info", JSON.stringify(data.plan));
    if (data.subscription) localStorage.setItem("zapmax_subscription_info", JSON.stringify(data.subscription));
    if (data.usage) localStorage.setItem("zapmax_plan_usage", JSON.stringify(data.usage));
    localStorage.setItem("zapmax_trial_blocked", String(!!data.trial_blocked));
    if (data.trial_days_left !== undefined) localStorage.setItem("zapmax_trial_days_left", String(data.trial_days_left));
    localStorage.setItem("zapmax_is_admin_plan", String(!!data.is_admin));
  };

  useEffect(() => {
    if (!userId) {
      setTrialBlocked(false);
      setIsAdmin(false);
      setTrialDaysLeft(null);
      setLoading(false);
      return;
    }
    if (fetchedRef.current === userId) return;
    fetchedRef.current = userId;

    let cancelled = false;
    const doFetch = async () => {
      // Silent loading
      // setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-plan-limits", {
          method: "POST",
          body: {},
        });
        if (cancelled) return;
        if (!error && data?.success && data.data) {
          applyData(data.data);
        }
      } catch (e) {
        console.error("Failed to fetch plan limits:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, [userId]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    fetchedRef.current = null;
    // setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-plan-limits", {
        method: "POST",
        body: {},
      });
      if (!error && data?.success && data.data) {
        applyData(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch plan limits:", e);
    } finally {
      setLoading(false);
      fetchedRef.current = userId;
    }
  }, [userId]);

  const canCreateInstance = (): boolean => {
    if (isAdmin) return true;
    if (trialBlocked || !plan || !usage) return false;
    return usage.instances < plan.max_instances;
  };

  const canSendMessage = (): boolean => {
    if (isAdmin) return true;
    if (trialBlocked || !plan || !usage) return false;
    if (plan.max_messages === null) return true;
    return usage.messages_this_month < plan.max_messages;
  };

  const messageLimitReached = !isAdmin && !!plan && !!usage && plan.max_messages !== null && usage.messages_this_month >= plan.max_messages;

  const canAddUser = (): boolean => {
    if (isAdmin) return true;
    if (!plan || !usage) return false;
    return usage.members < plan.max_users;
  };

  const canAddBot = (): boolean => {
    if (isAdmin) return true;
    if (!plan || !usage) return false;
    return usage.bots < plan.max_bots;
  };

  const canUploadStorage = (additionalMb: number = 0): boolean => {
    if (isAdmin) return true;
    if (!plan || !usage) return false;
    return (usage.storage_mb + additionalMb) <= plan.storage_mb;
  };

  const getUsagePercent = (key: "instances" | "messages" | "members" | "bots" | "storage"): number => {
    if (!plan || !usage) return 0;
    switch (key) {
      case "instances": return Math.round((usage.instances / plan.max_instances) * 100);
      case "messages": return plan.max_messages ? Math.round((usage.messages_this_month / plan.max_messages) * 100) : 0;
      case "members": return Math.round((usage.members / plan.max_users) * 100);
      case "bots": return Math.round((usage.bots / plan.max_bots) * 100);
      case "storage": return Math.round((usage.storage_mb / plan.storage_mb) * 100);
      default: return 0;
    }
  };

  return {
    loading,
    hasPlan,
    trialBlocked,
    trialDaysLeft,
    isAdmin,
    plan,
    subscription,
    usage,
    refetch,
    canCreateInstance,
    canSendMessage,
    messageLimitReached,
    canAddUser,
    canAddBot,
    canUploadStorage,
    getUsagePercent,
  };
}
