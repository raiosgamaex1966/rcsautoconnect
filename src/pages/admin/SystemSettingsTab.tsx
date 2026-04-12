import { useState, useEffect } from "react";
import { AlertTriangle, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemToggles { registration: boolean; autoTrial: boolean; detailedLogs: boolean; }

export default function SystemSettingsTab() {
  const { t } = useLanguage();
  const s = t.admin.system;
  const [toggles, setToggles] = useState<SystemToggles>(() => {
    const cached = localStorage.getItem("rcs_admin_system_settings");
    return cached ? JSON.parse(cached) : { registration: true, autoTrial: true, detailedLogs: false };
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [resettingCache, setResettingCache] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"reset" | "disconnect" | null>(null);

  const settingToggles = [
    { label: s.userRegistration, desc: s.userRegistrationDesc, key: "registration" as const },
    { label: s.autoTrial, desc: s.autoTrialDesc, key: "autoTrial" as const },
  ];

  useEffect(() => { loadSettings(); }, []);

  const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-data", { method: "POST", body: { _action: action, ...payload } });
    if (error) throw new Error(error.message || "Failed");
    return data as { success?: boolean; data?: any; error?: string };
  };

  const loadSettings = async () => {
    try {
      const json = await callAdmin("get-settings");
      if (json.success && json.data) {
        const d = json.data;
        const newToggles = { registration: d.registration ?? true, autoTrial: d.auto_trial ?? true, detailedLogs: d.detailed_logs ?? false };
        setToggles(newToggles);
        localStorage.setItem("rcs_admin_system_settings", JSON.stringify(newToggles));
      }
    } catch (e) { console.error("Failed to load settings:", e); }
    finally { setLoading(false); }
  };

  const handleToggle = (key: keyof SystemToggles) => { setToggles((prev) => ({ ...prev, [key]: !prev[key] })); setHasChanges(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const json = await callAdmin("save-settings", { registration: toggles.registration, auto_trial: toggles.autoTrial, detailed_logs: toggles.detailedLogs });
      if (json.success) {
        setHasChanges(false);
        toast.success(s.savedOk);
        localStorage.setItem("rcs_admin_system_settings", JSON.stringify(toggles));
      } else toast.error(s.saveError);
    } catch { toast.error(s.saveError); }
    finally { setSaving(false); }
  };

  const handleResetCache = async () => {
    setConfirmAction(null);
    setResettingCache(true);
    try {
      const json = await callAdmin("reset-cache");
      if (json.success) toast.success(s.cacheResetOk);
      else toast.error(json.error || s.cacheResetError);
    } catch { toast.error(s.cacheResetError); }
    finally { setResettingCache(false); }
  };

  const handleDisconnectAll = async () => {
    setConfirmAction(null);
    setDisconnecting(true);
    try {
      const json = await callAdmin("disconnect-all");
      if (json.success) {
        const { disconnected, failed, total } = json.data;
        toast.success(`${s.disconnectResult.replace("{disconnected}", disconnected).replace("{total}", total)}${failed > 0 ? ` (${failed} failed)` : ""}`);
      } else toast.error(json.error || s.disconnectError);
    } catch { toast.error(s.disconnectError); }
    finally { setDisconnecting(false); }
  };

  // Silent loading
  // if (loading) return ...;

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base">{s.generalSettings}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{s.globalAdjustments}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
            {settingToggles.map((item) => (
              <div key={item.key} className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="font-medium text-xs sm:text-sm">{item.label}</Label>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                </div>
                <Switch checked={toggles[item.key]} onCheckedChange={() => handleToggle(item.key)} className="shrink-0" />
              </div>
            ))}
            <Separator />
            <Button className="gap-1.5 w-full sm:w-auto" onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? s.saving : s.saveChanges}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> {s.dangerZone}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border border-destructive/30">
              <div>
                <p className="text-sm font-medium">{s.resetCache}</p>
                <p className="text-xs text-muted-foreground">{s.resetCacheDesc}</p>
              </div>
              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 w-full sm:w-auto" onClick={() => setConfirmAction("reset")} disabled={resettingCache}>
                {resettingCache ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {s.resetting}</> : s.resetCacheBtn}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border border-destructive/30">
              <div>
                <p className="text-sm font-medium">{s.disconnectAll}</p>
                <p className="text-xs text-muted-foreground">{s.disconnectAllDesc}</p>
              </div>
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => setConfirmAction("disconnect")} disabled={disconnecting}>
                {disconnecting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {s.disconnecting}</> : s.disconnectAllBtn}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmAction === "reset"} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.resetCache}</AlertDialogTitle>
            <AlertDialogDescription>{s.resetConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetCache} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {s.resetCacheBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction === "disconnect"} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.disconnectAll}</AlertDialogTitle>
            <AlertDialogDescription>{s.disconnectConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {s.disconnectAllBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
