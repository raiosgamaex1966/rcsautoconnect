import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, Lock, User, Crown, Building2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePlans } from "@/hooks/usePlans";
import { useLanguage } from "@/contexts/LanguageContext";

const planIcons: Record<string, React.ElementType> = {
  "Starter": User,
  "Grátis": User,
  "Profissional": Crown,
  "Empresarial": Building2,
};

function formatPrice(cents: number) {
  if (cents === 0) return "R$ 0";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function Planos() {
  const navigate = useNavigate();
  const { plans, subscription, loading } = usePlans();
  const { t } = useLanguage();

  function getPlanFeatures(plan: { name: string; max_instances: number; max_messages: number | null; storage_mb: number; support_level: string; max_bots: number }) {
    return [
      { text: t.plans.features.whatsappNumbers.replace("{count}", String(plan.max_instances)), included: true },
      { text: plan.max_messages ? t.plans.features.aiMessagesMonth.replace("{count}", String(plan.max_messages)) : t.plans.features.unlimitedMessages, included: !!plan.max_messages || plan.name !== "Starter" },
      { text: t.plans.features.autoAI, included: plan.name !== "Starter" && plan.name !== "Grátis" },
      { text: t.plans.features.autoScheduling, included: plan.name !== "Starter" && plan.name !== "Grátis" },
      { text: t.plans.features.storage.replace("{count}", String(plan.storage_mb)), included: true },
      { text: t.plans.features.support.replace("{level}", plan.support_level), included: true },
    ];
  }

  const handleSubscribe = (plan: { name: string; checkout_url?: string | null }) => {
    if (plan.checkout_url?.trim()) {
      window.open(plan.checkout_url.trim(), "_blank", "noopener,noreferrer");
    } else {
      toast.info(t.plans.checkoutNotConfigured.replace("{name}", plan.name));
    }
  };



  const currentPlanId = subscription?.plan_id;
  const isTrialing = subscription?.status === "trial";
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      {/* Trial Banner */}
      {isTrialing && trialDaysLeft > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm">{t.plans.trialBanner}</p>
                <p className="text-[10px] sm:text-sm text-muted-foreground">
                  {t.plans.trialDaysLeft.replace("{count}", String(trialDaysLeft))}
                </p>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto shrink-0 h-8 sm:h-9 text-xs sm:text-sm" onClick={() => handleSubscribe({ name: "Profissional" })}>{t.plans.subscribe}</Button>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2 sm:space-y-3">
        <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs">
          {t.plans.headerBadge}
        </Badge>
        <h1 className="text-xl sm:text-3xl font-bold">
          {t.plans.headerTitle.replace("{highlight}", "").replace("{/highlight}", "").split("seu negócio").length > 1
            ? <>{t.plans.headerTitle.split("{highlight}")[0]}<span className="text-primary">{t.plans.headerTitle.split("{highlight}")[1]?.split("{/highlight}")[0]}</span>{t.plans.headerTitle.split("{/highlight}")[1]}</>
            : t.plans.headerTitle.replace("{highlight}", "").replace("{/highlight}", "")
          }
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
          {t.plans.headerDesc}
        </p>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{t.plans.noPlans}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {plans.map((plan, i) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const isHighlighted = i === plans.length - 1 || plan.name === "Empresarial";
            const Icon = planIcons[plan.name] || User;
            const features = getPlanFeatures(plan);

            return (
              <Card
                key={plan.id}
                className={`relative ${isHighlighted ? "border-primary shadow-lg shadow-primary/10" : ""}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-secondary text-[10px] sm:text-xs">{t.plans.currentPlan}</Badge>
                  </div>
                )}
                {isHighlighted && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-[10px] sm:text-xs">{t.plans.recommended}</Badge>
                  </div>
                )}
                <CardContent className="pt-6 sm:pt-8 pb-4 sm:pb-6 text-center space-y-4 sm:space-y-6">
                  <Icon className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">{plan.name}</h3>
                    <div className="mt-1 sm:mt-2">
                      <span className="text-2xl sm:text-4xl font-bold">{formatPrice(plan.price_cents)}</span>
                      {plan.price_cents > 0 && <span className="text-xs sm:text-sm text-muted-foreground">{t.plans.perMonth}</span>}
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3 text-left">
                    {features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs sm:text-sm">
                        {f.included ? (
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={f.included ? "" : "text-muted-foreground"}>{f.text}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full text-xs sm:text-sm ${isHighlighted ? "bg-primary hover:bg-primary/90" : ""}`}
                    variant={isHighlighted ? "default" : "outline"}
                    disabled={isCurrentPlan}
                    onClick={() => !isCurrentPlan && handleSubscribe(plan)}
                  >
                    {isCurrentPlan ? t.plans.currentPlan : t.plans.subscribe}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-center text-[10px] sm:text-sm text-muted-foreground space-y-1">
        <p>{t.plans.footer1}</p>
        <p>{t.plans.footer2}</p>
      </div>
    </div>
  );
}
