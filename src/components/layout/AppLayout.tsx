import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import FloatingWhatsAppButton from "@/components/FloatingWhatsAppButton";
import { OnboardingGuard } from "../OnboardingGuard";

export function AppLayout() {
  const { pathname } = useLocation();
  const showFloatingButton = pathname === "/dashboard";

  return (
    <SidebarProvider>
      <OnboardingGuard>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <SidebarInset>
            <header className="sticky top-0 z-20 h-12 flex items-center border-b border-border bg-background px-2">
              <SidebarTrigger className="ml-1" />
            </header>
            <div className="flex flex-1 flex-col overflow-auto relative z-10">
              <Outlet />
            </div>
          </SidebarInset>
          {showFloatingButton && <FloatingWhatsAppButton />}
        </div>
      </OnboardingGuard>
    </SidebarProvider>
  );
}

