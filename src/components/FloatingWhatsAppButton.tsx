import { useState, useEffect } from "react";
import {
  MessageCircle, Headphones, Globe, HelpCircle, Phone, Mail, Send,
  Zap, Heart, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, React.ComponentType<any>> = {
  MessageCircle, Headphones, Globe, HelpCircle, Phone, Mail, Send, Zap, Heart, ShieldCheck,
};

interface ButtonConfig {
  phone: string;
  default_message: string;
  button_text: string;
  position: string;
  icon: string;
  button_color: string;
  text_color: string;
  show_text: boolean;
  active: boolean;
}

const positionClasses: Record<string, string> = {
  "bottom-right": "bottom-5 right-5",
  "bottom-left": "bottom-5 left-5",
  "top-right": "top-5 right-5",
  "top-left": "top-5 left-5",
};

export default function FloatingWhatsAppButton() {
  const [config, setConfig] = useState<ButtonConfig | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("floating_button_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig(data);
      });
  }, []);

  if (!config || !config.active || !config.phone) return null;

  const Icon = iconMap[config.icon] || MessageCircle;
  const url = `https://wa.me/${config.phone}?text=${encodeURIComponent(config.default_message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed ${positionClasses[config.position] || "bottom-5 right-5"} z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-all hover:scale-110 hover:shadow-2xl`}
      style={{ backgroundColor: config.button_color, color: config.text_color }}
      aria-label="WhatsApp"
    >
      <Icon className="h-5 w-5" />
      {config.show_text && (
        <span className="text-sm font-semibold whitespace-nowrap">{config.button_text}</span>
      )}
    </a>
  );
}
