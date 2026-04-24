import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const COOKIE_KEY = "rcs_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  const texts = (t as any).cookies ?? {
    title: "Utilizamos cookies",
    description: "Usamos cookies para melhorar sua experiência, analisar o tráfego e personalizar conteúdo.",
    learnMore: "Saiba mais",
    reject: "Recusar",
    accept: "Aceitar",
  };

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem(COOKIE_KEY, accepted ? "accepted" : "rejected");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 inset-x-0 z-50 flex justify-center px-4"
        >
          <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl p-4 w-full max-w-md flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{texts.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {texts.description}{" "}
                <Link to="/privacidade" className="text-primary hover:underline font-medium">{texts.learnMore}</Link>
              </p>
            </div>
            <div className="flex items-center gap-2 w-full">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleConsent(false)}>
                {texts.reject}
              </Button>
              <Button size="sm" className="flex-1" onClick={() => handleConsent(true)}>
                {texts.accept}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
