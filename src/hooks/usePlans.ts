import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Plan {
  id: string;
  name: string;
  price_cents: number;
  max_instances: number;
  max_messages: number | null;
  max_bots: number;
  max_users: number;
  storage_mb: number;
  support_level: string;
  trial_days: number;
  active: boolean;
  checkout_url: string | null;
}

export interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  started_at: string;
}

export function usePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>(() => {
    const cached = localStorage.getItem("zapmax_plans");
    return cached ? JSON.parse(cached) : [];
  });
  const [subscription, setSubscription] = useState<Subscription | null>(() => {
    const cached = localStorage.getItem("zapmax_subscription");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      // setLoading(true);

      const { data: plansRes } = await supabase.functions.invoke("data-api", {
        body: { _action: "plans-list-public" },
      });
      if (plansRes?.success && plansRes.data) {
        setPlans(plansRes.data);
        localStorage.setItem("zapmax_plans", JSON.stringify(plansRes.data));
      }

      if (user) {
        const { data: subRes } = await supabase.functions.invoke("data-api", {
          body: { _action: "subscription-get" },
        });
        if (subRes?.success && subRes.data) {
          setSubscription(subRes.data);
          localStorage.setItem("zapmax_subscription", JSON.stringify(subRes.data));
        }
      }

      setLoading(false);
    };
    fetch();
  }, [user]);

  return { plans, subscription, loading };
}