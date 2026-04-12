import { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Mail, Lock, Eye, EyeOff, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notRobot, setNotRobot] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockout = useCallback(() => {
    const until = Date.now() + LOCKOUT_SECONDS * 1000;
    setLockedUntil(until);
    setCountdown(LOCKOUT_SECONDS);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setLockedUntil(null);
        setCountdown(0);
        setFailedAttempts(0);
        setNotRobot(false);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, []);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const loginTexts = t.login as any;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        startLockout();
        toast.error(loginTexts.tooManyAttempts || `Muitas tentativas. Aguarde ${LOCKOUT_SECONDS}s.`);
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        toast.error(
          error.message === "Invalid login credentials"
            ? `${t.login.invalidCredentials} (${remaining} ${loginTexts.attemptsLeft || "tentativa(s) restante(s)"})`
            : error.message
        );
      }
    } else {
      setFailedAttempts(0);
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.login.resetSent);
      setForgotOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card>
          <CardContent className="py-8 px-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <MessageCircle className="h-5 w-5 text-primary-foreground" />
                </motion.div>
                <span className="text-2xl font-bold">RCS <span className="text-primary">AutoConnect</span></span>
              </div>
              <h1 className="text-xl font-bold">{t.login.welcomeBack}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t.login.subtitle}</p>
            </motion.div>

            {isLocked && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 mb-4"
              >
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  {loginTexts.lockedMessage || "Conta temporariamente bloqueada."}{" "}
                  <span className="font-bold">{countdown}s</span>
                </p>
              </motion.div>
            )}

            <motion.form onSubmit={handleLogin} className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
              <div className="space-y-2">
                <Label htmlFor="email">{t.login.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder={t.login.emailPlaceholder} className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLocked} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t.login.password}</Label>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setForgotEmail(email); setForgotOpen(true); }}>{t.login.forgotPassword}</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder={t.login.passwordPlaceholder} className="pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLocked} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Not a robot */}
              <button
                type="button"
                onClick={() => !isLocked && setNotRobot(!notRobot)}
                disabled={isLocked}
                className={cn(
                  "w-full flex items-center justify-between rounded-md border px-4 py-3 transition-all duration-300",
                  isLocked && "opacity-50 cursor-not-allowed",
                  notRobot ? "border-primary bg-primary/5" : "border-input bg-background hover:border-muted-foreground/50"
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

              <Button type="submit" className="w-full" disabled={loading || !notRobot || isLocked}>
                {loading ? t.login.signingIn : t.login.signIn}
              </Button>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }} className="mt-6 text-center text-sm text-muted-foreground">
              {t.login.noAccount}{" "}
              <Link to="/cadastro" className="text-primary hover:underline font-medium">{t.login.createFree}</Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.login.forgotTitle}</DialogTitle>
            <DialogDescription>{t.login.forgotDesc}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.login.email}</Label>
              <Input type="email" placeholder={t.login.emailPlaceholder} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={forgotLoading}>
              {forgotLoading ? t.login.sending : t.login.sendResetLink}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
