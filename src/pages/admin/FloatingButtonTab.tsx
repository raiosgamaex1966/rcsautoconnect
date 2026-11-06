import { useState, useEffect } from "react";
import {
  MessageCircle, Headphones, Globe, HelpCircle, Phone, Mail, Send,
  Zap, Heart, ShieldCheck, Save, Loader2, Eye, SlidersHorizontal, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const iconComponents: Record<string, any> = { MessageCircle, Headphones, Globe, HelpCircle, Phone, Mail, Send, Zap, Heart, ShieldCheck };
const iconKeys = Object.keys(iconComponents);

interface ButtonSettings {
  id: string; phone: string; default_message: string; button_text: string;
  position: string; icon: string; button_color: string; text_color: string;
  show_text: boolean; active: boolean;
}

const defaults: Omit<ButtonSettings, "id"> = {
  phone: "", default_message: "Olá! Gostaria de saber mais informações.",
  button_text: "Precisa de ajuda?", position: "bottom-right", icon: "MessageCircle",
  button_color: "#25D366", text_color: "#ffffff", show_text: true, active: true,
};

const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-data", { method: "POST", body: { _action: action, ...payload } });
  if (error) throw new Error(error.message || "Failed");
  return data as { success?: boolean; data?: any; error?: string };
};

export default function FloatingButtonTab() {
  const { t } = useLanguage();
  const f = t.admin.floatingBtn;
  const [settings, setSettings] = useState<ButtonSettings | null>(() => {
    const cached = localStorage.getItem("rcs_admin_floating_btn");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const positionOptions = [
    { value: "bottom-right", label: f.positions.bottomRight },
    { value: "bottom-left", label: f.positions.bottomLeft },
    { value: "top-right", label: f.positions.topRight },
    { value: "top-left", label: f.positions.topLeft },
  ];

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    // setLoading(true);
    try {
      const json = await callAdmin("floating-btn-get");
      const s = json.data ? json.data : { id: "", ...defaults };
      setSettings(s);
      localStorage.setItem("rcs_admin_floating_btn", JSON.stringify(s));
    } catch { setSettings({ id: "", ...defaults }); }
    setLoading(false);
  };

  const update = (partial: Partial<ButtonSettings>) => setSettings((prev) => (prev ? { ...prev, ...partial } : prev));

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const json = await callAdmin("floating-btn-save", {
        id: settings.id || undefined, phone: settings.phone, default_message: settings.default_message,
        button_text: settings.button_text, position: settings.position, icon: settings.icon,
        button_color: settings.button_color, text_color: settings.text_color,
        show_text: settings.show_text, active: settings.active,
      });
      if (json.success) {
        const s = json.data || settings;
        setSettings(s);
        localStorage.setItem("rcs_admin_floating_btn", JSON.stringify(s));
        toast.success(f.savedOk);
      } else toast.error(f.saveError);
    } catch { toast.error(f.saveError); }
    setSaving(false);
  };

  // Silent loading
  // if (loading) return ...;
  if (!settings) return null;

  const SelectedIcon = iconComponents[settings.icon] || MessageCircle;
  const positionClasses: Record<string, string> = { "bottom-right": "bottom-4 right-4", "bottom-left": "bottom-4 left-4", "top-right": "top-4 right-4", "top-left": "top-4 left-4" };
  const iconLabels = f.icons as Record<string, string>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> {f.mainConfig}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.whatsappNumber}</Label>
              <Input value={settings.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="5511999999999" className="text-sm" />
              <p className="text-[10px] text-muted-foreground">{f.numberFormat}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.defaultMessage}</Label>
              <Input value={settings.default_message} onChange={(e) => update({ default_message: e.target.value })} className="text-sm" />
              <p className="text-[10px] text-muted-foreground">{f.defaultMessageHint}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.buttonText}</Label>
              <Input value={settings.button_text} onChange={(e) => update({ button_text: e.target.value })} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.screenPosition}</Label>
              <Select value={settings.position} onValueChange={(v) => update({ position: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{positionOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> {f.appearance}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div>
            <Label className="text-xs sm:text-sm mb-2 block">{f.buttonIcon}</Label>
            <div className="grid grid-cols-5 gap-2">
              {iconKeys.map((key) => {
                const Icon = iconComponents[key];
                return (
                  <button key={key} onClick={() => update({ icon: key })} className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all ${settings.icon === key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground/30"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">{iconLabels[key] || key}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.buttonColor}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.button_color} onChange={(e) => update({ button_color: e.target.value })} className="h-10 w-10 rounded border border-border cursor-pointer" />
                <Input value={settings.button_color} onChange={(e) => update({ button_color: e.target.value })} className="text-sm flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs sm:text-sm">{f.textIconColor}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.text_color} onChange={(e) => update({ text_color: e.target.value })} className="h-10 w-10 rounded border border-border cursor-pointer" />
                <Input value={settings.text_color} onChange={(e) => update({ text_color: e.target.value })} className="text-sm flex-1" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2"><Switch checked={settings.show_text} onCheckedChange={(v) => update({ show_text: v })} /><Label className="text-xs sm:text-sm">{f.showTextBeside}</Label></div>
            <div className="flex items-center gap-2"><Switch checked={settings.active} onCheckedChange={(v) => update({ active: v })} /><Label className="text-xs sm:text-sm">{f.buttonActive}</Label></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Eye className="h-4 w-4" /> {f.preview}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="relative bg-muted rounded-lg h-40 overflow-hidden">
            <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{f.previewHint}</p>
            {settings.active && (
              <div className={`absolute ${positionClasses[settings.position] || "bottom-4 right-4"}`}>
                <button className="flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: settings.button_color, color: settings.text_color }}>
                  <SelectedIcon className="h-5 w-5" />
                  {settings.show_text && <span className="text-sm font-medium whitespace-nowrap">{settings.button_text}</span>}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? f.saving : f.saveSettings}
        </Button>
      </div>
    </div>
  );
}
