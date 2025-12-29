import { Construction, ArrowLeft, AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface MaintenanceModeProps {
  title?: string;
  description?: string;
}

export const MaintenanceMode = ({ 
  title = "Упс! Щось пішло не так",
  description = "Виникла непередбачена помилка. Спробуйте оновити сторінку."
}: MaintenanceModeProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <Card className="max-w-2xl w-full p-8 md:p-12 glass-effect border-border/50 text-center">
        <div className="w-20 h-20 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          {title}
        </h1>
        
        <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto whitespace-pre-line">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="default"
            onClick={() => window.location.reload()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Спробувати знову
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
          >
            <Home className="w-4 h-4 mr-2" />
            На головну
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-6">
          Якщо помилка повторюється, зверніться до підтримки
        </p>
      </Card>
    </div>
  );
};
