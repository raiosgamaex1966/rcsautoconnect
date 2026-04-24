import { motion } from "framer-motion";
import { Users, CreditCard, Smartphone, BarChart3, Settings, Shield, Activity, Globe, Loader2, Rocket, MousePointerClick } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import UsersTab from "./admin/UsersTab";
import PlansTab from "./admin/PlansTab";
import InstancesTab from "./admin/InstancesTab";
import MetricsTab from "./admin/MetricsTab";
import SystemSettingsTab from "./admin/SystemSettingsTab";
import EvolutionApiTab from "./admin/EvolutionApiTab";
import RoadmapTab from "./admin/RoadmapTab";
import FloatingButtonTab from "./admin/FloatingButtonTab";

export default function Admin() {
  const { isAdmin, isRoleLoading } = useUserRole();
  const { t } = useLanguage();

  if (!isRoleLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              {t.admin.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t.admin.subtitle}</p>
          </div>
          <Badge variant="outline" className="text-[10px] sm:text-xs">
            <Activity className="h-3 w-3 mr-1" />
            {t.admin.systemOperational}
          </Badge>
        </div>
      </div>

      <div>
        <Tabs defaultValue="users" className="space-y-3 sm:space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 w-full">
            <TabsList className="w-max sm:w-full justify-start">
              <TabsTrigger value="users" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><Users className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.users}</span></TabsTrigger>
              <TabsTrigger value="plans" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><CreditCard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.plans}</span></TabsTrigger>
              <TabsTrigger value="instances" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.instances}</span></TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.metrics}</span></TabsTrigger>
              <TabsTrigger value="evolution" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><Globe className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.evolution}</span></TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><Rocket className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.roadmap}</span></TabsTrigger>
              <TabsTrigger value="settings" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.system}</span></TabsTrigger>
              <TabsTrigger value="floating-btn" className="gap-1 text-[11px] sm:text-xs px-2 sm:px-3"><MousePointerClick className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.admin.tabs.floatingBtn}</span></TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="plans"><PlansTab /></TabsContent>
          <TabsContent value="instances"><InstancesTab /></TabsContent>
          <TabsContent value="metrics"><MetricsTab /></TabsContent>
          <TabsContent value="evolution"><EvolutionApiTab /></TabsContent>
          <TabsContent value="roadmap"><RoadmapTab /></TabsContent>
          <TabsContent value="settings"><SystemSettingsTab /></TabsContent>
          <TabsContent value="floating-btn"><FloatingButtonTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
