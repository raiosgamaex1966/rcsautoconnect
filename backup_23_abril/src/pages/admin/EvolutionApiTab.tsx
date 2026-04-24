import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Key, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface EvolutionStatus {
  has_url: boolean; has_key: boolean; connection_ok: boolean;
  connection_error: string; base_url_masked: string;
}

export default function EvolutionApiTab() {
  const { t } = useLanguage();
  const e = t.admin.evolution;
  const [status, setStatus] = useState<EvolutionStatus | null>(() => {
    const cached = localStorage.getItem("zapmax_admin_evolution_status");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchStatus = async () => {
    // setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data", { method: "POST", body: { _action: "evolution-status" } });
      if (error) { console.error("Evolution status error:", error); toast.error(e.statusCheckError); }
      else if (data?.success) {
        setStatus(data.data);
        localStorage.setItem("zapmax_admin_evolution_status", JSON.stringify(data.data));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    await fetchStatus();
    setTesting(false);
    if (status?.connection_ok) toast.success(e.connectionVerified);
  };

  useEffect(() => { fetchStatus(); }, []);

  // Silent loading
  // if (loading && !status) return ...;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Globe className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />{e.credentials}</CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">{e.credentialsDesc}</p>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
          {status?.has_url && status.base_url_masked && (
            <div className="space-y-1"><span className="text-xs text-muted-foreground">{e.baseUrlConfigured}</span><p className="text-sm font-mono bg-muted/50 rounded px-3 py-2">{status.base_url_masked}</p></div>
          )}
          {status?.connection_ok && <div className="flex items-center gap-2 text-xs sm:text-sm text-primary"><CheckCircle2 className="h-4 w-4" />{e.connectionVerified}</div>}
          {status && !status.connection_ok && status.has_url && status.has_key && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-destructive"><XCircle className="h-4 w-4" />{e.connectionFailed}{status.connection_error ? `: ${status.connection_error}` : ""}</div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={testConnection} disabled={testing || loading} className="text-xs sm:text-sm">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}{e.verifyConnection}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="text-sm sm:text-base">{e.integrationStatus}</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
              <span className="text-xs sm:text-sm flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {e.baseUrl}</span>
              <Badge variant={status?.has_url ? "default" : "secondary"} className="text-[10px] sm:text-xs">{status?.has_url ? e.configured : e.notConfigured}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
              <span className="text-xs sm:text-sm flex items-center gap-1.5"><Key className="h-3.5 w-3.5" /> {e.apiKey}</span>
              <Badge variant={status?.has_key ? "default" : "secondary"} className="text-[10px] sm:text-xs">{status?.has_key ? e.configured : e.notConfigured}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
              <span className="text-xs sm:text-sm flex items-center gap-1.5">
                {status?.connection_ok ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}{e.connection}
              </span>
              <Badge variant={status?.connection_ok ? "default" : "destructive"} className="text-[10px] sm:text-xs">{status?.connection_ok ? e.connectionActive : e.connectionInactive}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
