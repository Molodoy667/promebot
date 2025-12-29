import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

export const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent", "rejected");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
      <Card className="p-4 sm:p-6 glass-effect border-primary/20 shadow-glow">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              Використання Cookie
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ми використовуємо cookie для покращення вашого досвіду. Продовжуючи використовувати сайт, ви погоджуєтесь з нашою політикою cookie.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleAccept}
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow w-full sm:w-auto"
              >
                Погодитись
              </Button>
              <Button
                onClick={handleReject}
                variant="outline"
                className="border-primary/20 hover:bg-primary/10 w-full sm:w-auto"
              >
                Відхилити
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReject}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
