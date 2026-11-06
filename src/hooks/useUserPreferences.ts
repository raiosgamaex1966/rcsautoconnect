import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";

export interface UserPreferences {
  theme: string;
  language: string;
  ai_default_enabled: boolean;
}

const defaults: UserPreferences = {
  theme: "dark",
  language: "pt-br",
  ai_default_enabled: true,
};

const themeMap: Record<string, string> = {
  dark: "dark",
  light: "light",
  system: "system",
};

export function useUserPreferences() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const cached = localStorage.getItem("rcs_user_preferences");
    return cached ? JSON.parse(cached) : defaults;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // setLoading(true);
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "user-preferences-get" },
      });

      if (!error && data?.success) {
        const d = data.data || {};
        const prefs = {
          theme: d.theme || defaults.theme,
          language: d.language || defaults.language,
          ai_default_enabled: d.ai_default_enabled ?? defaults.ai_default_enabled,
        };
        setPreferences(prefs);
        localStorage.setItem("rcs_user_preferences", JSON.stringify(prefs));
        setTheme(themeMap[prefs.theme] || "dark");
      } else {
        // Fallback to defaults or cache if error
        const cached = localStorage.getItem("rcs_user_preferences");
        if (cached) setTheme(themeMap[JSON.parse(cached).theme] || "dark");
        else setTheme("dark");
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const update = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      if (partial.theme) setTheme(themeMap[partial.theme] || "dark");
      localStorage.setItem("rcs_user_preferences", JSON.stringify(next));
      return next;
    });
  }, [setTheme]);

  const save = useCallback(async () => {
    if (!user) return false;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: {
        _action: "user-preferences-upsert",
        theme: preferences.theme,
        language: preferences.language,
        ai_default_enabled: preferences.ai_default_enabled,
      },
    });
    setSaving(false);
    return !error && data?.success;
  }, [user, preferences]);

  return { preferences, update, save, loading, saving };
}
