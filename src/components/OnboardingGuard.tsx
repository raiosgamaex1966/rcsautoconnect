import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building, Loader2 } from "lucide-react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [hasTenant, setHasTenant] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingInProgress, setOnboardingInProgress] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (!user) {
      setHasTenant(null);
      setLoading(false);
      return;
    }

    const checkTenant = async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (profile?.tenant_id) {
          setHasTenant(true);
          setLoading(false);
        } else {
          // No tenant! Try to auto-onboard if company name is in metadata
          const metaCompany = user.user_metadata?.company;
          if (metaCompany) {
            handleOnboarding(metaCompany);
          } else {
            // Need to ask for company name
            setHasTenant(false);
            setShowModal(true);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error checking tenant:", err);
        setLoading(false);
      }
    };

    checkTenant();
  }, [user]);

  const handleOnboarding = async (name: string) => {
    if (!name.trim() || onboardingInProgress) return;
    
    setOnboardingInProgress(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding", {
        body: { company_name: name.trim() }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Onboarding failed");
      }

      toast.success("Configuração concluída com sucesso!");
      setHasTenant(true);
      setShowModal(false);
      
      // Refresh the page or relevant context to pick up new tenant_id
      window.location.reload();
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error("Erro ao configurar sua conta. Por favor, tente novamente.");
    } finally {
      setOnboardingInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If onboarding is in progress but not via modal (auto-onboarding)
  if (onboardingInProgress && !showModal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Preparando seu ambiente...</h2>
        <p className="text-muted-foreground">Isso deve levar apenas alguns segundos.</p>
      </div>
    );
  }

  return (
    <>
      {children}

      <Dialog open={showModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Finalize seu cadastro
            </DialogTitle>
            <DialogDescription>
              Para começar, precisamos saber o nome da sua empresa ou negócio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                placeholder="Ex: Minha Loja, Gina Macramê..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={() => handleOnboarding(companyName)}
              disabled={!companyName.trim() || onboardingInProgress}
            >
              {onboardingInProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                "Concluir Configuração"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
