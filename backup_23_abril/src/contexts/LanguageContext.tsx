import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type Translations, type Language, getTranslations } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "pt-br",
  setLanguage: () => {},
  t: getTranslations("pt-br"),
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>("pt-br");

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("user_preferences")
      .select("language")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.language) {
          setLanguageState(data.language as Language);
        }
      });
  }, [user]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = getTranslations(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
