import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageCircle, Bot, CalendarDays, Zap, Shield, ArrowRight, Check, Star,
  Clock, Smartphone, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import FloatingWhatsAppButton from "@/components/FloatingWhatsAppButton";
import { CookieConsent } from "@/components/CookieConsent";
import { useLanguage } from "@/contexts/LanguageContext";

interface LandingPlan {
  id: string; name: string; price_cents: number; max_instances: number;
  max_messages: number | null; support_level: string; max_bots: number;
  storage_mb: number; checkout_url: string;
}

function formatPrice(cents: number): string {
  if (cents === 0) return "0";
  return (cents / 100).toFixed(0);
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } }),
};
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.12, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const features = [
    { icon: Bot, title: t.landing.features.items.ai.title, description: t.landing.features.items.ai.desc },
    { icon: CalendarDays, title: t.landing.features.items.scheduling.title, description: t.landing.features.items.scheduling.desc },
    { icon: MessageCircle, title: t.landing.features.items.multiAgent.title, description: t.landing.features.items.multiAgent.desc },
    { icon: Zap, title: t.landing.features.items.instant.title, description: t.landing.features.items.instant.desc },
    { icon: Shield, title: t.landing.features.items.api.title, description: t.landing.features.items.api.desc },
    { icon: Clock, title: t.landing.features.items.reminders.title, description: t.landing.features.items.reminders.desc },
  ];

  function getPlanFeatures(plan: LandingPlan): string[] {
    const f: string[] = [];
    f.push(t.plans.features.whatsappNumbers.replace("{count}", plan.max_instances.toString()));
    f.push(plan.max_messages ? t.plans.features.aiMessagesMonth.replace("{count}", plan.max_messages.toString()) : t.plans.features.unlimitedMessages);
    
    // AI level
    if (plan.name === "Starter") f.push(t.plans.features.basicAI);
    else if (plan.name === "Enterprise" || plan.name === "Empresarial") f.push(t.plans.features.customAI);
    else f.push(t.plans.features.advancedAI);

    // Scheduling
    if (plan.name === "Starter") f.push(t.plans.features.simpleScheduling);
    else f.push(t.plans.features.fullScheduling);

    // Support
    f.push(t.plans.features.support.replace("{level}", (plan.support_level === "Standard" ? "Padrão" : plan.support_level === "Priority" ? "Prioritário" : plan.support_level) || ""));

    if (plan.name !== "Starter") f.push(t.plans.features.advancedReports);
    return f;
  }

  useEffect(() => {
    supabase
      .from("plans")
      .select("id, name, price_cents, max_instances, max_messages, support_level, max_bots, storage_mb, checkout_url")
      .eq("active", true as any)
      .order("price_cents", { ascending: true })
      .then(({ data }) => { setPlans(data || []); setPlansLoading(false); });
  }, []);

  const highlights = [
    { value: "24/7", label: t.landing.highlights.availability },
    { value: "AI", label: t.landing.highlights.autoService },
    { value: "WhatsApp", label: t.landing.highlights.nativeIntegration },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary"><MessageCircle className="h-5 w-5 text-primary-foreground" /></div>
            <span className="text-xl font-bold">RCS <span className="text-primary">AutoConnect</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <button onClick={() => scrollToSection("features")} className="hover:text-foreground transition-colors">{t.landing.nav.features}</button>
            <button onClick={() => scrollToSection("pricing")} className="hover:text-foreground transition-colors">{t.landing.nav.plans}</button>
            <button onClick={() => scrollToSection("stats")} className="hover:text-foreground transition-colors">{t.landing.nav.results}</button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>{t.landing.nav.signIn}</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => navigate("/cadastro")}>
              <span className="hidden sm:inline">{t.landing.nav.startFree}</span>
              <span className="sm:hidden">{t.landing.nav.start}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
            <Zap className="h-3.5 w-3.5" /> {t.landing.hero.badge}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }} className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
            {t.landing.hero.title.split("{highlight}")[0]}<span className="text-primary">{t.landing.hero.title.split("{highlight}")[1]?.split("{/highlight}")[0]}</span>{t.landing.hero.title.split("{/highlight}")[1]}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.landing.hero.subtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.65 }} className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6" onClick={() => navigate("/cadastro")}>{t.landing.hero.cta} <ArrowRight className="h-5 w-5 ml-2" /></Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => navigate("/login")}>{t.landing.hero.hasAccount}</Button>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.8 }} className="text-sm text-muted-foreground mt-4">{t.landing.hero.noCreditCard}</motion.p>
        </div>
      </section>

      {/* Highlights */}
      <section id="stats" className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="grid grid-cols-3 gap-8">
            {highlights.map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">{t.landing.features.title.split("{highlight}")[0]}<span className="text-primary">{t.landing.features.title.split("{highlight}")[1]?.split("{/highlight}")[0]}</span>{t.landing.features.title.split("{/highlight}")[1]}</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{t.landing.features.subtitle}</p>
        </motion.div>
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title} variants={scaleIn} custom={i}>
              <Card className="group hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                <CardContent className="py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors"><f.icon className="h-6 w-6" /></div>
                  <h3 className="font-bold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-card/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">{t.landing.pricing.title.split("{highlight}")[0]}<span className="text-primary">{t.landing.pricing.title.split("{highlight}")[1]?.split("{/highlight}")[0]}</span>{t.landing.pricing.title.split("{/highlight}")[1]}</h2>
            <p className="text-muted-foreground mt-3">{t.landing.pricing.subtitle}</p>
          </motion.div>
          {false ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className={`grid gap-6 max-w-5xl mx-auto ${plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
              {plans.map((plan, i) => {
                const isPopular = i === 1 && plans.length >= 3;
                const planFeatures = getPlanFeatures(plan);
                return (
                  <motion.div key={plan.id} variants={scaleIn} custom={i}>
                    <Card className={`relative h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isPopular ? "border-primary shadow-lg shadow-primary/10" : "hover:shadow-primary/5"}`}>
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><Star className="h-3 w-3" /> {t.landing.pricing.mostPopular}</span>
                        </div>
                      )}
                      <CardContent className="py-8 text-center">
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t.plans.features.whatsappNumbers.replace("{count}", plan.max_instances.toString())}</p>
                        <div className="mt-6">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-5xl font-extrabold">{formatPrice(plan.price_cents)}</span>
                          <span className="text-muted-foreground">{t.plans.perMonth}</span>
                        </div>
                        <Button className={`w-full mt-6 ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`} variant={isPopular ? "default" : "outline"} onClick={() => { if (plan.checkout_url?.trim()) { window.open(plan.checkout_url.trim(), "_blank", "noopener,noreferrer"); } else { navigate("/cadastro"); } }}>
                          {t.landing.pricing.startNow} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                        <ul className="mt-6 space-y-3 text-left text-sm">
                          {planFeatures.map((feat) => (
                            <li key={feat} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary shrink-0" /><span>{feat}</span></li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8 sm:p-12 md:p-16">
          <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}>
            <Smartphone className="h-12 w-12 text-primary mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold">{t.landing.cta.title}</h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto">{t.landing.cta.subtitle}</p>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-10 py-6 mt-8" onClick={() => navigate("/cadastro")}>{t.landing.cta.button} <ArrowRight className="h-5 w-5 ml-2" /></Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary"><MessageCircle className="h-3.5 w-3.5 text-primary-foreground" /></div>
            <span className="font-bold text-foreground">RCS <span className="text-primary">AutoConnect</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-foreground transition-colors">{(t.landing as any).footerPrivacy}</Link>
            <span>•</span>
            <Link to="/termos" className="hover:text-foreground transition-colors">{(t.landing as any).footerTerms}</Link>
          </div>
          <p>© {new Date().getFullYear()} RCS AutoConnect. {t.landing.footer}</p>
        </div>
      </footer>
      <FloatingWhatsAppButton />
      <CookieConsent />
    </div>
  );
}
