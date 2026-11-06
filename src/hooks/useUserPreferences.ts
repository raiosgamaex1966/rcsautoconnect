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
  const { theme: activeTheme, setTheme } = useTheme();
  const currentActiveTheme = (typeof window !== "undefined" ? localStorage.getItem("theme") : null) || activeTheme || "light";

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const cached = localStorage.getItem("rcs_user_preferences");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return {
          theme: parsed.theme || currentActiveTheme,
          language: parsed.language || "pt-br",
          ai_default_enabled: parsed.ai_default_enabled ?? true,
        };
      } catch {}
    }
    return {
      theme: currentActiveTheme,
      language: "pt-br",
      ai_default_enabled: true,
    };
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

      if (!error && data?.success && data.data) {
        const d = data.data;
        const currentLocalTheme = localStorage.getItem("theme") || activeTheme || "light";
        const prefs = {
          theme: d.theme || currentLocalTheme,
          language: d.language || "pt-br",
          ai_default_enabled: d.ai_default_enabled ?? true,
        };
        setPreferences(prefs);
        localStorage.setItem("rcs_user_preferences", JSON.stringify(prefs));
        if (d.theme && themeMap[d.theme]) {
          setTheme(themeMap[d.theme]);
        }
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
