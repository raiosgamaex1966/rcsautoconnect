import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Edit, Trash2, Plus, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp } from "./AdminHelpers";
import { useLanguage } from "@/contexts/LanguageContext";

interface Plan {
  id: string; name: string; price_cents: number; max_messages: number | null;
  max_instances: number; max_users: number; max_bots: number; storage_mb: number;
  support_level: string; trial_days: number; active: boolean; checkout_url: string;
}

export default function PlansTab() {
  const { t } = useLanguage();
  const p = t.admin.plans;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    // setLoading(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "plans-list" },
    });
    if (!error && data?.success) setPlans(data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const updateField = (id: string, field: keyof Plan, value: any) => {
    setPlans((prev) => prev.map((pl) => (pl.id === id ? { ...pl, [field]: value } : pl)));
  };

  const handleSavePlan = async (plan: Plan) => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: {
        _action: "plans-update",
        id: plan.id,
        name: plan.name, price_cents: plan.price_cents, max_messages: plan.max_messages,
        max_instances: plan.max_instances, max_users: 1, max_bots: 1, storage_mb: plan.storage_mb,
        support_level: plan.support_level, trial_days: plan.trial_days, active: plan.active, checkout_url: plan.checkout_url,
      },
    });
    if (error || !data?.success) toast.error(p.saveError);
    else { toast.success(p.savedOk); setEditingId(null); }
    setSaving(false);
  };

  const handleAddPlan = async () => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "plans-create" },
    });
    if (error || !data?.success) toast.error(p.createError);
    else { setPlans((prev) => [...prev, data.data]); setEditingId(data.data.id); toast.success(p.newPlanAdded); }
  };

  const handleDeletePlan = async (id: string) => {
    const plan = plans.find((pl) => pl.id === id);
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "plans-delete", id },
    });
    if (error || !data?.success) toast.error(p.deleteError);
    else { setPlans((prev) => prev.filter((pl) => pl.id !== id)); toast.success(p.planRemoved.replace("{name}", plan?.name || "")); }
  };

  const handleToggleActive = async (id: string) => {
    const plan = plans.find((pl) => pl.id === id);
    if (!plan) return;
    const newActive = !plan.active;
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "plans-update", id, active: newActive },
    });
    if (error || !data?.success) toast.error(p.updateError);
    else { updateField(id, "active", newActive); toast.info(newActive ? p.activated.replace("{name}", plan.name) : p.deactivated.replace("{name}", plan.name)); }
  };

  const fields = [
    { key: "price_cents", label: p.priceCents, type: "number" },
    { key: "max_messages", label: p.msgsMonth, type: "number" },
    { key: "max_instances", label: p.whatsappInstances, type: "number" },
    { key: "storage_mb", label: p.storageMB, type: "number" },
    { key: "support_level", label: p.support, type: "text" },
    { key: "trial_days", label: p.trialDays, type: "number" },
    { key: "checkout_url", label: p.checkoutUrl, type: "url" },
  ] as { key: keyof Plan; label: string; type: string }[];

  // Silent loading
  // if (loading) return ...;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base">{p.configTitle}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{p.configDesc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          {plans.map((plan) => {
            const isEditing = editingId === plan.id;
            return (
              <motion.div key={plan.id} variants={fadeUp} custom={0} initial="hidden" animate="visible">
                <div className={`p-3 sm:p-4 rounded-lg border space-y-3 transition-colors ${isEditing ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                      {isEditing ? (
                        <Input className="w-full sm:w-40 h-8 text-sm font-semibold" value={plan.name} onChange={(e) => updateField(plan.id, "name", e.target.value)} />
                      ) : (
                        <span className="font-semibold text-sm sm:text-base truncate">{plan.name}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <Switch checked={plan.active} onCheckedChange={() => handleToggleActive(plan.id)} />
                        <span className="text-xs text-muted-foreground">{plan.active ? p.activeLabel : p.inactiveLabel}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 self-end sm:self-auto">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSavePlan(plan)} disabled={saving}><Save className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(null); fetchPlans(); }}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(plan.id)}><Edit className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePlan(plan.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    {fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                        <Input className="h-8 text-sm" type={field.type} value={String(plan[field.key] ?? "")} onChange={(e) => updateField(plan.id, field.key, field.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} disabled={!isEditing} readOnly={!isEditing} />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="gap-1.5 w-full sm:w-auto" onClick={handleAddPlan}>
              <Plus className="h-4 w-4" /> {p.newPlan}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
