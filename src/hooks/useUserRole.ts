import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("zapmax_user_role"));
  const [isRoleLoading, setIsRoleLoading] = useState(() => !localStorage.getItem("zapmax_user_role"));

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRole(null);
      setIsRoleLoading(false);
      return;
    }

    supabase.functions.invoke("data-api", {
      body: { _action: "user-role-get" },
    }).then(({ data, error }) => {
      if (error || !data?.success) {
        console.error("Error fetching role:", error);
        setRole(null);
        localStorage.removeItem("zapmax_user_role");
      } else {
        const roles = data.data || [];
        const isAdmin = roles.some((r: any) => r.role === "admin");
        const finalRole = isAdmin ? "admin" : roles[0]?.role || null;
        setRole(finalRole);
        if (finalRole) localStorage.setItem("zapmax_user_role", finalRole);
        else localStorage.removeItem("zapmax_user_role");
      }
      setIsRoleLoading(false);
    }).catch(() => {
      setRole(null);
      localStorage.removeItem("zapmax_user_role");
      setIsRoleLoading(false);
    });
  }, [user?.id, authLoading]);

  return { role, isAdmin: role === "admin", isRoleLoading };
}