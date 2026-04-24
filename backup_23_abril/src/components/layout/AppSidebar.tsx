import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFloatingButtonPhone } from "@/hooks/useFloatingButtonPhone";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageCircle,
  Smartphone,
  Users,
  CalendarDays,
  Settings,
  CreditCard,
  HelpCircle,
  Map,
  Headphones,
  Sparkles,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  LogOut,
  Shield,
  AlertTriangle,
  Kanban,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Menu items are now built dynamically inside the component using translations

const textVariants = {
  visible: { opacity: 1, x: 0, width: "auto", transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as const } },
  hidden: { opacity: 0, x: -8, width: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
};

const expandVariants = {
  initial: { opacity: 0, height: 0, scale: 0.95 },
  animate: { opacity: 1, height: "auto", scale: 1, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] as const } },
  exit: { opacity: 0, height: 0, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
};

const popupVariants = {
  initial: { opacity: 0, y: 8, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as const } },
};

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin: isAdminRole } = useUserRole();
  const { plan, trialDaysLeft, messageLimitReached, isAdmin: isAdminPlan, loading: planLoading } = usePlanLimits();
  const { t } = useLanguage();
  const { openWhatsApp } = useFloatingButtonPhone();

  const menuItems = [
    { title: t.sidebar.dashboard, icon: LayoutDashboard, path: "/dashboard" },
    { title: t.sidebar.conversations, icon: MessageCircle, path: "/conversas" },
    { title: "Kanban", icon: Kanban, path: "/kanban" },
    { title: t.sidebar.contacts, icon: Users, path: "/contatos" },
    { title: t.sidebar.whatsapp, icon: Smartphone, path: "/whatsapp" },
    { title: t.sidebar.schedules, icon: CalendarDays, path: "/agendamentos" },
    { title: t.sidebar.settings, icon: Settings, path: "/configuracoes" },
    { title: t.sidebar.team, icon: Users, path: "/equipe" },
    { title: t.sidebar.plans, icon: CreditCard, path: "/planos" },
    { title: t.sidebar.howToUse, icon: HelpCircle, path: "/como-usar" },
    { title: t.sidebar.roadmap, icon: Map, path: "/roadmap" },
  ];
  const adminItem = { title: t.sidebar.admin, icon: Shield, path: "/admin" };

  const isSystemAdmin = isAdminRole; // Only people in user_roles are system admins
  const isFreePlan = !planLoading && plan && plan.price_cents === 0;
  const isTrialExpired = isFreePlan && (trialDaysLeft === 0 || trialDaysLeft === null);
  const showTrialBanner = isFreePlan && !isSystemAdmin;
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initial = displayName.charAt(0).toUpperCase();
  const visibleMenu = isSystemAdmin ? [...menuItems, adminItem] : menuItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <motion.div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <MessageCircle className="h-4 w-4 text-primary-foreground" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="logo-text"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={textVariants}
                className="text-lg font-bold text-foreground whitespace-nowrap overflow-hidden"
              >
                RCS <span className="text-primary">AutoConnect</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.sidebar.menu}</SidebarGroupLabel>
          <SidebarMenu>
            {visibleMenu.map((item, i) => (
              <SidebarMenuItem key={item.path}>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                >
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {!collapsed && (item.path === "/conversas" || item.path === "/kanban") && messageLimitReached && (
                      <div className="ml-auto flex items-center justify-center">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-pulse" />
                      </div>
                    )}
                  </SidebarMenuButton>
                </motion.div>
              </SidebarMenuItem>
            ))}
            {showTrialBanner && (
              <motion.div
                key="trial-banner"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="px-2 pb-4 mt-2"
              >
                {isTrialExpired ? (
                  <div className="rounded-lg bg-destructive/15 border border-destructive/30 p-3">
                    <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {t.sidebar.trialExpired}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.sidebar.upgradeToContine}</p>
                    <button
                      onClick={() => navigate("/planos")}
                      className="mt-2 w-full rounded-md bg-destructive text-destructive-foreground text-xs font-medium py-1.5 hover:bg-destructive/90 transition-colors"
                    >
                      {t.sidebar.viewPlans}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-primary/20 border border-primary/30 p-3">
                    <div className="flex items-center gap-2 text-primary text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      {t.sidebar.trialPeriod}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.sidebar.daysLeft.replace("{count}", String(trialDaysLeft))}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-1">
        <SidebarMenuButton tooltip={t.sidebar.support} onClick={() => openWhatsApp("Olá! Preciso de suporte.")}>
          <Headphones className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                key="support-text"
                variants={textVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex flex-col overflow-hidden"
              >
                <span className="text-xs">{t.sidebar.support}</span>
                <span className="text-[10px] text-muted-foreground">{t.sidebar.supportDesc}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarMenuButton>
        <SidebarMenuButton
          tooltip={theme === "dark" ? t.sidebar.lightTheme : t.sidebar.darkTheme}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="shrink-0"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                key="theme-text"
                variants={textVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="text-xs overflow-hidden whitespace-nowrap"
              >
                {theme === "dark" ? t.sidebar.lightTheme : t.sidebar.darkTheme}
              </motion.span>
            )}
          </AnimatePresence>
        </SidebarMenuButton>

        {/* User menu */}
        <div className="relative">
          <AnimatePresence>
            {userMenuOpen && !collapsed && (
              <motion.div
                key="user-popup"
                variants={popupVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-50"
              >
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                  onClick={() => { navigate("/configuracoes"); setUserMenuOpen(false); }}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>{t.sidebar.settings}</span>
                </button>
                <div className="border-t border-border" />
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                  onClick={async () => { await signOut(); navigate("/"); setUserMenuOpen(false); }}
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  <span>{t.sidebar.logout}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarMenuButton tooltip={displayName} onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-bold"
            >
              {initial}
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  key="user-info"
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="flex items-center flex-1 min-w-0 gap-1 overflow-hidden"
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-medium truncate">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</span>
                  </div>
                  <motion.div
                    animate={{ rotate: userMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-3 w-3 shrink-0" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
