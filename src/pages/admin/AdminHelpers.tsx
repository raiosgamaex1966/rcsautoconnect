import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export const useStatusBadge = () => {
  const { t } = useLanguage();
  return (status: string) => {
    const labels = t.admin.statusBadges as Record<string, string>;
    const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      suspended: "destructive",
      trial: "secondary",
      cancelled: "outline",
      connected: "default",
      disconnected: "secondary",
      error: "destructive",
      connecting: "outline",
    };
    const variant = variantMap[status] || "outline";
    const label = labels[status] || status;
    return <Badge variant={variant}>{label}</Badge>;
  };
};

// Keep legacy export for backward compat during migration
export const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Ativo" },
    suspended: { variant: "destructive", label: "Suspenso" },
    trial: { variant: "secondary", label: "Trial" },
    cancelled: { variant: "outline", label: "Cancelado" },
    connected: { variant: "default", label: "Conectado" },
    disconnected: { variant: "secondary", label: "Desconectado" },
    error: { variant: "destructive", label: "Erro" },
    connecting: { variant: "outline", label: "Conectando" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};
