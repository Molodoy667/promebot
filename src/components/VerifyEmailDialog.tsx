import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";

interface VerifyEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
  onSuccess: () => void;
}

type Step = "send" | "verify";

export const VerifyEmailDialog = ({
  open,
  onOpenChange,
  userId,
  email,
  onSuccess,
}: VerifyEmailDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("send");
  const [code, setCode] = useState("");

  const handleSendCode = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: {
          action: "send",
          userId,
          email,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Помилка відправки коду");
      }

      toast({
        title: "Код відправлено",
        description: "Перевірте ваш email. Код діє 10 хвилин.",
        duration: 3000,
      });

      setStep("verify");
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося відправити код",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: {
          action: "verify",
          userId,
          code,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Невірний код");
      }

      toast({
        title: "Успіх!",
        description: "Email успішно підтверджено",
        duration: 2000,
      });

      setCode("");
      setStep("send");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося підтвердити код",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setStep("send");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Підтвердження email</DialogTitle>
          <DialogDescription>
            {step === "send" 
              ? "Відправимо код підтвердження на вашу пошту"
              : "Введіть 6-значний код з email"}
          </DialogDescription>
        </DialogHeader>

        {step === "send" && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Email адреса:
              </p>
              <p className="font-medium">{email}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isLoading}
              >
                Скасувати
              </Button>
              <Button
                onClick={handleSendCode}
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Відправка...
                  </>
                ) : (
                  "Отримати код"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-code" className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Код підтвердження
              </Label>
              <Input
                id="verify-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="bg-background/60 text-center text-2xl tracking-widest"
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Код діє 10 хвилин
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("send")}
                className="flex-1"
                disabled={isLoading}
              >
                Назад
              </Button>
              <Button
                onClick={handleVerifyCode}
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Перевірка...
                  </>
                ) : (
                  "Підтвердити"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
