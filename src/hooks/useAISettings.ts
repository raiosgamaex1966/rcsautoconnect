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
  image_understanding_enabled: boolean;
  audio_transcription_enabled: boolean;
  voice_enabled: boolean;
  voice_id: string;
}

const defaults: AISettings = {
  ai_enabled: true,
  focus_mode: "hibrido",
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
  openai_model: "gpt-4o",
  image_understanding_enabled: false,
  audio_transcription_enabled: false,
  voice_enabled: false,
  voice_id: "alloy",
};

export function useAISettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AISettings>(() => {
    const cached = localStorage.getItem("rcs_ai_settings");
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
          image_understanding_enabled: d.image_understanding_enabled ?? false,
          audio_transcription_enabled: d.audio_transcription_enabled ?? false,
          voice_enabled: d.voice_enabled ?? false,
          voice_id: d.voice_id || "alloy",
        };
        setSettings(newSettings);
        localStorage.setItem("rcs_ai_settings", JSON.stringify(newSettings));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const update = useCallback((partial: Partial<AISettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = useCallback(async (overrides?: Partial<AISettings>) => {
    if (!user) return false;
    setSaving(true);
    try {
      const { data: tenantData } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
      let tenantId = tenantData;
      
      if (!tenantId) {
        const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
        tenantId = prof?.tenant_id;
      }
      if (!tenantId) {
        const { data: mem } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).limit(1).maybeSingle();
        tenantId = mem?.tenant_id;
      }
      
      if (!tenantId) {
        console.error("No tenant found for user");
        return false;
      }

      const finalSettings = overrides ? { ...settings, ...overrides } : settings;
      
      // Sanitize settings for DB
      const dbSettings: any = { 
        tenant_id: tenantId,
        ai_enabled: finalSettings.ai_enabled,
        focus_mode: finalSettings.focus_mode,
        tone: finalSettings.tone,
        general_instructions: finalSettings.general_instructions,
        formatting_style: finalSettings.formatting_style,
        greeting: finalSettings.greeting,
        farewell: finalSettings.farewell,
        forbidden_responses: finalSettings.forbidden_responses,
        human_trigger_words: finalSettings.human_trigger_words,
        business_type: finalSettings.business_type,
        business_hours: finalSettings.business_hours,
        openai_model: finalSettings.openai_model,
        image_understanding_enabled: finalSettings.image_understanding_enabled,
        audio_transcription_enabled: finalSettings.audio_transcription_enabled,
        voice_enabled: finalSettings.voice_enabled,
        voice_id: finalSettings.voice_id,
      };

      // Only include API key if it's not the masked placeholder
      if (finalSettings.openai_api_key && !finalSettings.openai_api_key.startsWith("sk-...")) {
        dbSettings.openai_api_key = finalSettings.openai_api_key;
      }

      const { error } = await supabase
        .from("ai_settings")
        .upsert(dbSettings, { onConflict: "tenant_id" });

      if (error) {
        console.error("Error saving AI settings to DB:", error);
        return false;
      }

      localStorage.setItem("rcs_ai_settings", JSON.stringify(finalSettings));
      return true;
    } catch (err) {
      console.error("Exception saving AI settings:", err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings, user]);


  return { settings, update, save, loading, saving };
}
