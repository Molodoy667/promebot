import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NeuroPromotionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const loadingSteps = [
  "Збираю інформацію про канал...",
  "Синхронізую дані з Telegram...",
  "Аналізую статистику каналу...",
  "Шукаю в відкритих реєстрах...",
  "Перевіряю політику Telegram...",
  "Виконую фінальну перевірку..."
];

// Валідація Telegram каналу
const validateTelegramChannel = (input: string): boolean => {
  const trimmed = input.trim();
  
  // Перевірка на username (з @ або без)
  const usernameRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
  
  // Перевірка на повне посилання t.me
  const linkRegex = /^(https?:\/\/)?(t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,32})$/;
  
  return usernameRegex.test(trimmed) || linkRegex.test(trimmed);
};

export function NeuroPromotion({ open, onOpenChange }: NeuroPromotionProps) {
  const [channelLink, setChannelLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<{ type: 1 | 2 | 3; message: string } | null>(null);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelLink.trim()) {
      setValidationError("Будь ласка, введіть посилання на канал");
      return;
    }

    // Валідація формату Telegram каналу
    if (!validateTelegramChannel(channelLink)) {
      setValidationError("Невірний формат. Введіть @username або https://t.me/username");
      return;
    }

    setValidationError("");
    setError(null);
    setIsLoading(true);
    setCurrentStep(0);

    // Анімація кроків завантаження
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 10000); // 10 секунд на кожен крок

    // Через 60 секунд показуємо випадкову помилку
    setTimeout(() => {
      clearInterval(interval);
      setIsLoading(false);
      
      // Випадково вибираємо одну з трьох помилок
      const randomValue = Math.random();
      let errorType: 1 | 2 | 3;
      
      if (randomValue < 0.33) {
        errorType = 1;
      } else if (randomValue < 0.66) {
        errorType = 2;
      } else {
        errorType = 3;
      }
      
      if (errorType === 1) {
        setError({
          type: 1,
          message: "Ваш канал раніше приймав участь в накрутці та не може бути доданий в наш сервіс через політику Telegram. Ми дотримуємось усіх правил та регламентів платформи."
        });
      } else if (errorType === 2) {
        setError({
          type: 2,
          message: "Ваш канал зареєстрований раніше місяця. На жаль Telegram не допускає такі канали до просування та реклами. Ми щиро вибачаємось, але це політика Telegram і ми нічого з цим зробити не можемо."
        });
      } else {
        setError({
          type: 3,
          message: "Ви не являєтесь власником цього каналу. Для додавання каналу в систему просування необхідно мати права адміністратора або власника каналу."
        });
      }
    }, 60000); // 60 секунд
  };

  const handleClose = () => {
    setChannelLink("");
    setIsLoading(false);
    setCurrentStep(0);
    setError(null);
    setValidationError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <DialogTitle>НейроПросування</DialogTitle>
          </div>
          <DialogDescription>
            Автоматично налаштуйте ваш канал для просування в Telegram та автопублікацій
          </DialogDescription>
        </DialogHeader>

        {!isLoading && !error && (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-link">Посилання на Telegram канал</Label>
              <Input
                id="channel-link"
                type="text"
                placeholder="https://t.me/your_channel або @your_channel"
                value={channelLink}
                onChange={(e) => {
                  setChannelLink(e.target.value);
                  setValidationError("");
                }}
                className={`w-full ${validationError ? 'border-destructive' : ''}`}
              />
              {validationError ? (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {validationError}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Вставте посилання на ваш Telegram канал для початку налаштування
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg">
              Почати налаштування
            </Button>
          </form>
        )}

        {isLoading && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary/20 animate-pulse" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-primary animate-pulse">
                  {loadingSteps[currentStep]}
                </p>
                <p className="text-sm text-muted-foreground">
                  Процес може зайняти до хвилини
                </p>
              </div>

              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Крок {currentStep + 1} з {loadingSteps.length}</span>
                  <span>{Math.round(((currentStep + 1) / loadingSteps.length) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep + 1) / loadingSteps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {loadingSteps.slice(0, currentStep + 1).map((step, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left duration-300"
                >
                  <div className={`h-2 w-2 rounded-full ${
                    index === currentStep ? 'bg-primary animate-pulse' : 'bg-green-500'
                  }`} />
                  <span className={index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm leading-relaxed">
                {error.message}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={handleClose} 
                variant="outline" 
                className="flex-1"
              >
                Закрити
              </Button>
              <Button 
                onClick={() => {
                  setError(null);
                  setChannelLink("");
                  setValidationError("");
                }}
                className="flex-1"
              >
                Спробувати інший канал
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
