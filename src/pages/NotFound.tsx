import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-extrabold text-primary">{t.notFound.title}</h1>
        <p className="text-xl text-muted-foreground">{t.notFound.subtitle}</p>
        <p className="text-sm text-muted-foreground">{t.notFound.routeNotExist.replace("{route}", location.pathname)}</p>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
            <Home className="h-4 w-4" /> {t.notFound.goHome}
          </Button>
          <Button onClick={() => navigate("/dashboard")} className="gap-2">
            {t.dashboard.title}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
