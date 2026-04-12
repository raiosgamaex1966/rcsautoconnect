import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Timer, SplitSquareHorizontal, Brain, Keyboard,
  ShieldAlert, PauseCircle, Loader2, Save,
} from "lucide-react";

interface InstanceSettings {
  debounce_enabled: boolean;
  debounce_seconds: number;
  split_messages_enabled: boolean;
  split_messages_limit: number;
  memory_enabled: boolean;
  memory_messages_count: number;
  typing_enabled: boolean;
  fallback_image: string;
  fallback_audio: string;
  pause_words: string;
  resume_words: string;
}

const defaultSettings: InstanceSettings = {
  debounce_enabled: false,
  debounce_seconds: 3,
  split_messages_enabled: false,
  split_messages_limit: 1000,
  memory_enabled: false,
  memory_messages_count: 20,
  typing_enabled: true,
  fallback_image: "Desculpe, não consigo visualizar imagens no momento. Por favor, descreva o que você precisa por texto.",
  fallback_audio: "Desculpe, não consigo ouvir áudios no momento. Por favor, escreva sua mensagem.",
  pause_words: "parar",
  resume_words: "voltar",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
}

export default function InstanceSettingsModal({ open, onOpenChange, instanceId, instanceName }: Props) {
  const { t } = useLanguage();
  const s = t.instanceSettings;
  const [settings, setSettings] = useState<InstanceSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "get-settings", instance_id: instanceId },
    }).then(({ data, error }) => {
      if (!error && data?.success && data.data) {
        const d = data.data;
        setSettings({
          debounce_enabled: d.debounce_enabled ?? false,
          debounce_seconds: d.debounce_seconds ?? 3,
          split_messages_enabled: d.split_messages_enabled ?? false,
          split_messages_limit: d.split_messages_limit ?? 1000,
          memory_enabled: d.memory_enabled ?? false,
          memory_messages_count: d.memory_messages_count ?? 20,
          typing_enabled: d.typing_enabled ?? true,
          fallback_image: d.fallback_image ?? defaultSettings.fallback_image,
          fallback_audio: d.fallback_audio ?? defaultSettings.fallback_audio,
          pause_words: d.pause_words ?? "parar",
          resume_words: d.resume_words ?? "voltar",
        });
      }
      setLoading(false);
    });
  }, [open, instanceId]);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "update-settings", instance_id: instanceId, settings },
    });
    setSaving(false);
    if (error || !data?.success) {
      toast.error(data?.error || s.saveError);
    } else {
      toast.success(s.savedOk);
      onOpenChange(false);
    }
  };

  const update = <K extends keyof InstanceSettings>(key: K, value: InstanceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⚙️ {s.title} — {instanceName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            <SettingSection icon={<Timer className="h-4 w-4" />} title={s.debounce} desc={s.debounceDesc}>
              <Switch checked={settings.debounce_enabled} onCheckedChange={v => update("debounce_enabled", v)} />
              {settings.debounce_enabled && (
                <div className="flex items-center gap-2 mt-3">
                  <Input type="number" min={1} max={30} className="w-20" value={settings.debounce_seconds} onChange={e => update("debounce_seconds", Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">{s.seconds}</span>
                </div>
              )}
            </SettingSection>

            <Separator />

            <SettingSection icon={<SplitSquareHorizontal className="h-4 w-4" />} title={s.splitMessages} desc={s.splitMessagesDesc}>
              <Switch checked={settings.split_messages_enabled} onCheckedChange={v => update("split_messages_enabled", v)} />
              {settings.split_messages_enabled && (
                <div className="flex items-center gap-2 mt-3">
                  <Label className="text-xs text-muted-foreground">{s.charLimit}</Label>
                  <Input type="number" min={100} max={5000} className="w-24" value={settings.split_messages_limit} onChange={e => update("split_messages_limit", Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground">{s.charsPerMessage}</span>
                </div>
              )}
            </SettingSection>

            <Separator />

            <SettingSection icon={<Brain className="h-4 w-4" />} title={s.memory} desc={s.memoryDesc}>
              <Switch checked={settings.memory_enabled} onCheckedChange={v => update("memory_enabled", v)} />
              {settings.memory_enabled && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">{s.rememberLast}</span>
                  <Input type="number" min={1} max={100} className="w-20" value={settings.memory_messages_count} onChange={e => update("memory_messages_count", Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground">{s.messagesCount}</span>
                </div>
              )}
            </SettingSection>

            <Separator />

            <SettingSection icon={<Keyboard className="h-4 w-4" />} title={s.typing} desc={s.typingDesc}>
              <Switch checked={settings.typing_enabled} onCheckedChange={v => update("typing_enabled", v)} />
            </SettingSection>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm uppercase tracking-wide">{s.fallbackTitle}</h4>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{s.fallbackImage}</Label>
                <Textarea rows={2} value={settings.fallback_image} onChange={e => update("fallback_image", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{s.fallbackAudio}</Label>
                <Textarea rows={2} value={settings.fallback_audio} onChange={e => update("fallback_audio", e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm uppercase tracking-wide">{s.pauseControl}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-destructive">{s.pauseWords}</Label>
                  <Input value={settings.pause_words} onChange={e => update("pause_words", e.target.value)} placeholder="parar" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-primary">{s.resumeWords}</Label>
                  <Input value={settings.resume_words} onChange={e => update("resume_words", e.target.value)} placeholder="voltar" />
                </div>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {s.saveSettings}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingSection({ icon, title, desc, children }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide">{title}</h4>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        {Array.isArray(children) ? children[0] : children}
      </div>
      {Array.isArray(children) && children.slice(1)}
    </div>
  );
}
