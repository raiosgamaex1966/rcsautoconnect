import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Mail, Lock, Eye, EyeOff, User, Phone, Building, ShieldX, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function Cadastro() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notRobot, setNotRobot] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  const passwordChecks = useMemo(() => ({
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  }), [password]);

  const strengthScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  const strengthLabel = useMemo(() => {
    const ps = (t.register as any).passwordStrength;
    if (strengthScore <= 1) return { label: ps.veryWeak, color: "bg-destructive" };
    if (strengthScore === 2) return { label: ps.weak, color: "bg-orange-500" };
    if (strengthScore === 3) return { label: ps.fair, color: "bg-yellow-500" };
    if (strengthScore === 4) return { label: ps.strong, color: "bg-emerald-500" };
    return { label: ps.veryStrong, color: "bg-green-500" };
  }, [strengthScore, t]);

  const isPasswordValid = strengthScore >= 3;

  useEffect(() => {
    supabase.functions
      .invoke("registration-status", { method: "POST", body: {} })
      .then(({ data, error }) => {
        if (error || !data?.success) { setRegistrationEnabled(false); return; }
        setRegistrationEnabled(data.data?.registration_enabled !== false);
      })
      .catch(() => setRegistrationEnabled(false));
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) { toast.error(t.register.minChars); return; }
    if (!company.trim()) { toast.error(t.register.companyRequired); return; }

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { 
        data: { 
          full_name: name, 
          phone,
          company: company // Save company name in metadata
        }, 
        emailRedirectTo: `${window.location.origin}/#/login` 
      },
    });

    if (authError) { setLoading(false); toast.error(authError.message); return; }

    if (authData.session) {
      try {
        const { error } = await supabase.functions.invoke("onboarding", { body: { company_name: company } });
        if (error) { console.error("Onboarding error:", error); toast.warning(t.register.onboardingError); }
      } catch (err) { console.error("Onboarding failed:", err); }
      setLoading(false);
      toast.success(t.register.created);
      navigate("/dashboard");
    } else {
      setLoading(false);
      toast.success(t.register.confirmEmail);
      navigate("/login");
    }
  };

  if (registrationEnabled === null) {
    return (<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>);
  }

  if (!registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
          <Card>
            <CardContent className="py-12 px-6 text-center">
              <div className="flex items-center justify-center mb-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"><ShieldX className="h-6 w-6 text-destructive" /></div></div>
              <h1 className="text-xl font-bold mb-2">{t.register.registrationDisabled}</h1>
              <p className="text-sm text-muted-foreground mb-6">{t.register.registrationDisabledDesc}</p>
              <Link to="/login"><Button variant="outline" className="w-full">{t.register.backToLogin}</Button></Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <Card>
          <CardContent className="py-8 px-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <MessageCircle className="h-5 w-5 text-primary-foreground" />
                </motion.div>
                <span className="text-2xl font-bold">RCS <span className="text-primary">AutoConnect</span></span>
              </div>
              <h1 className="text-xl font-bold">{t.register.createAccount}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t.register.subtitle}</p>
            </motion.div>

            <motion.form onSubmit={handleRegister} className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
              <div className="space-y-2">
                <Label htmlFor="name">{t.register.fullName}</Label>
                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="name" placeholder={t.register.fullNamePlaceholder} className="pl-10" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">{t.register.companyName}</Label>
                <div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="company" placeholder={t.register.companyPlaceholder} className="pl-10" value={company} onChange={(e) => setCompany(e.target.value)} required /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.register.email}</Label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" placeholder={t.register.emailPlaceholder} className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t.register.whatsapp}</Label>
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="phone" placeholder={t.register.whatsappPlaceholder} className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} required /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.register.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder={t.register.passwordPlaceholder} className="pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {password.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 pt-1">
                    {/* Strength bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= strengthScore ? strengthLabel.color : "bg-muted")} />
                        ))}
                      </div>
                      <span className={cn("text-xs font-medium", strengthScore >= 4 ? "text-emerald-500" : strengthScore >= 3 ? "text-yellow-500" : "text-destructive")}>
                        {strengthLabel.label}
                      </span>
                    </div>

                    {/* Requirements checklist */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {([
                        ["minLength", (t.register as any).passwordStrength.minLength],
                        ["uppercase", (t.register as any).passwordStrength.uppercase],
                        ["lowercase", (t.register as any).passwordStrength.lowercase],
                        ["number", (t.register as any).passwordStrength.number],
                        ["special", (t.register as any).passwordStrength.special],
                      ] as [keyof typeof passwordChecks, string][]).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-1">
                          {passwordChecks[key] ? (
                            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className={cn("text-[11px]", passwordChecks[key] ? "text-emerald-500" : "text-muted-foreground")}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
              {/* Not a robot */}
              <button
                type="button"
                onClick={() => setNotRobot(!notRobot)}
                className={cn(
                  "w-full flex items-center justify-between rounded-md border px-4 py-3 transition-all duration-300",
                  notRobot
                    ? "border-primary bg-primary/5"
                    : "border-input bg-background hover:border-muted-foreground/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    notRobot ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {notRobot && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                  <span className={cn("text-sm font-medium", notRobot ? "text-primary" : "text-foreground")}>
                    {notRobot ? ((t.register as any).verified || "Verificado") : ((t.register as any).notRobot || "Não sou um robô")}
                  </span>
                </div>
                <ShieldCheck className={cn("h-5 w-5 transition-colors duration-300", notRobot ? "text-primary" : "text-muted-foreground")} />
              </button>

              <Button type="submit" className="w-full" disabled={loading || !isPasswordValid || !notRobot}>{loading ? t.register.creating : t.register.createButton}</Button>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>
              <p className="text-xs text-center text-muted-foreground mt-4">
                {t.register.terms}{" "}
                <Link to="/termos" className="text-primary hover:underline font-medium">{(t.register as any).termsLink}</Link>
                {" "}{(t.register as any).termsAnd}{" "}
                <Link to="/privacidade" className="text-primary hover:underline font-medium">{(t.register as any).privacyLink}</Link>.
              </p>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {t.register.hasAccount}{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">{t.register.signIn}</Link>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
