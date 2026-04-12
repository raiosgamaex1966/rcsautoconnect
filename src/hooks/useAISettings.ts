import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AISettings {
  ai_enabled: boolean;
  focus_mode: string;
  tone: string;
  general_instructions: string;
  formatting_style: string;
  greeting: string;
  farewell: string;
  forbidden_responses: string;
  human_trigger_words: string;
  business_type: string;
  business_hours: string;
  openai_api_key: string;
  openai_model: string;
}

const defaults: AISettings = {
  ai_enabled: true,
  focus_mode: "base-conhecimento",
  tone: "amigavel",
  general_instructions: "",
  formatting_style: "",
  greeting: "",
  farewell: "",
  forbidden_responses: "",
  human_trigger_words: "",
  business_type: "",
  business_hours: "",
  openai_api_key: "",
  openai_model: "gpt-4o-mini",
};

export function useAISettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AISettings>(() => {
    const cached = localStorage.getItem("zapmax_ai_settings");
    return cached ? JSON.parse(cached) : defaults;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // setLoading(true);
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "ai-settings-get" },
      });

      if (!error && data?.success) {
        const d = data.data || {};
        const newSettings = {
          ai_enabled: d.ai_enabled ?? true,
          focus_mode: d.focus_mode || defaults.focus_mode,
          tone: d.tone || defaults.tone,
          general_instructions: d.general_instructions || "",
          formatting_style: d.formatting_style || "",
          greeting: d.greeting || "",
          farewell: d.farewell || "",
          forbidden_responses: d.forbidden_responses || "",
          human_trigger_words: d.human_trigger_words || "",
          business_type: d.business_type || "",
          business_hours: d.business_hours || "",
          openai_api_key: d.openai_api_key || "",
          openai_model: d.openai_model || defaults.openai_model,
        };
        setSettings(newSettings);
        localStorage.setItem("zapmax_ai_settings", JSON.stringify(newSettings));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const update = useCallback((partial: Partial<AISettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = useCallback(async (overrides?: Partial<AISettings>) => {
    setSaving(true);
    const finalSettings = overrides ? { ...settings, ...overrides } : settings;
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "ai-settings-upsert", ...finalSettings },
    });
    if (!error && data?.success) {
      localStorage.setItem("zapmax_ai_settings", JSON.stringify(finalSettings));
    }
    setSaving(false);
    return !error && data?.success;
  }, [settings]);

  return { settings, update, save, loading, saving };
}
