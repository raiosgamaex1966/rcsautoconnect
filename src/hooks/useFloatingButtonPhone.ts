import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFloatingButtonPhone() {
  const [phone, setPhone] = useState<string>("");

  useEffect(() => {
    supabase.functions.invoke("data-api", {
      body: { _action: "floating-btn-phone" },
    }).then(({ data }) => {
      if (data?.success && data.data?.phone) setPhone(data.data.phone);
    }).catch(() => {});
  }, []);

  const openWhatsApp = (customMessage?: string) => {
    if (!phone) return;
    const msg = encodeURIComponent(customMessage || "Olá!");
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return { phone, openWhatsApp };
}