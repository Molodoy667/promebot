import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import notFoundImage from "@/assets/404-illustration.png";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in">
        {/* Image with scale animation */}
        <div className="animate-scale-in">
          <img 
            src={notFoundImage} 
            alt="404 - Сторінку не знайдено" 
            className="w-full max-w-lg mx-auto drop-shadow-2xl"
          />
        </div>

        {/* Content */}
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Упс! Сторінку не знайдено
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Схоже, що ця сторінка відправилась у цифрову відпустку. 
            Давайте повернемось на головну!
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="bg-gradient-primary hover:opacity-90 transition-all shadow-glow hover:shadow-glow-lg text-primary-foreground font-semibold gap-2 hover-scale"
          >
            <Home className="w-5 h-5" />
            На головну
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 hover-scale"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад
          </Button>
        </div>

        {/* Decorative floating elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-primary-glow/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-primary/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
