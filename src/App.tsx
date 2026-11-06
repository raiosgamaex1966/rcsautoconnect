import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { MotionConfig } from "framer-motion";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Conversas from "./pages/Conversas";
import Contatos from "./pages/Contatos";
import WhatsAppPage from "./pages/WhatsAppPage";
import Agendamentos from "./pages/Agendamentos";
import Configuracoes from "./pages/Configuracoes";
import Planos from "./pages/Planos";
import ComoUsar from "./pages/ComoUsar";
import Roadmap from "./pages/Roadmap";
import Admin from "./pages/Admin";
import Kanban from "./pages/Kanban";
import Equipe from "./pages/Equipe";
import Fluxos from "./pages/Fluxos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Global safety net for unhandled promise rejections (prevents blank screens)
  React.useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <MotionConfig transition={{ duration: 0 }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <LanguageProvider>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/termos" element={<TermsOfUse />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* App (authenticated) */}
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/conversas" element={<Conversas />} />
                  <Route path="/kanban" element={<Kanban />} />
                  <Route path="/contatos" element={<Contatos />} />
                  <Route path="/whatsapp" element={<WhatsAppPage />} />
                  <Route path="/agendamentos" element={<Agendamentos />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/equipe" element={<Equipe />} />
                  <Route path="/planos" element={<Planos />} />
                  <Route path="/como-usar" element={<ComoUsar />} />
                  <Route path="/roadmap" element={<Roadmap />} />
                  <Route path="/fluxos" element={<Fluxos />} />
                  <Route path="/admin" element={<Admin />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </LanguageProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  </ThemeProvider>
  );
};

export default App;
