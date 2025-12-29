import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  children?: ReactNode;
}

export const PageHeader = ({
  icon: Icon,
  title,
  description,
  backTo,
  backLabel = "Назад",
  children,
}: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <Card className="group relative p-6 sm:p-8 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-md border-border/50 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        {backTo && (
          <Button
            variant="ghost"
            onClick={() => navigate(backTo)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backLabel}
          </Button>
        )}

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-slow flex-shrink-0">
            <Icon className="w-7 h-7 text-primary-foreground animate-float" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              {title}
              <Sparkles className="w-5 h-5 text-primary animate-spin-slow" />
            </h1>
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
};
