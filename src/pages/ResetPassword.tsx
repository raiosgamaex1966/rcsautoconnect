import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      toast.error(t.resetPassword.invalidLink);
      navigate("/login");
    }
  }, [navigate, t]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error(t.resetPassword.mismatch); return; }
    if (password.length < 6) { toast.error(t.resetPassword.minChars); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); } else { toast.success(t.resetPassword.updated); navigate("/dashboard"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <Card>
          <CardContent className="py-8 px-6">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary"><MessageCircle className="h-5 w-5 text-primary-foreground" /></div>
                <span className="text-2xl font-bold">RCS <span className="text-primary">AutoConnect</span></span>
              </div>
              <h1 className="text-xl font-bold">{t.resetPassword.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t.resetPassword.subtitle}</p>
            </div>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t.resetPassword.newPassword}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder={t.resetPassword.newPasswordPlaceholder} className="pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t.resetPassword.confirmPassword}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm" type={showPassword ? "text" : "password"} placeholder={t.resetPassword.confirmPlaceholder} className="pl-10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? t.resetPassword.updating : t.resetPassword.update}</Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
