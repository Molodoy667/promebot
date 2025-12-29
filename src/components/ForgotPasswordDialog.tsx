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
import { Mail, Lock, KeyRound } from "lucide-react";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "email" | "code" | "password";

export const ForgotPasswordDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: ForgotPasswordDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          action: "request",
          email: email.toLowerCase(),
        },
      });

      if (error) {
        // Обробляємо помилку від edge function
        throw new Error(error.message || "Помилка відправки коду");
      }

      if (!data.success) {
        throw new Error(data.error || "Помилка відправки коду");
      }

      toast({
        title: "Код відправлено",
        description: "Перевірте ваш email. Код діє 10 хвилин.",
        duration: 3000,
      });

      setStep("code");
    } catch (error: any) {
      console.error("Error requesting reset code:", error);
      
      // Особлива обробка для помилки "не знайдено"
      const isNotFound = error.message?.includes("не знайдено") || 
                        error.message?.includes("not found");
      
      toast({
        title: isNotFound ? "Email не знайдено" : "Помилка",
        description: error.message || "Не вдалося відправити код",
        variant: "destructive",
        duration: isNotFound ? 3000 : 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          action: "verify",
          email: email.toLowerCase(),
          code,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Невірний код");
      }

      toast({
        title: "Код підтверджено",
        description: "Введіть новий пароль",
        duration: 2000,
      });

      setStep("password");
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Помилка",
        description: "Паролі не співпадають",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Помилка",
        description: "Пароль має містити мінімум 6 символів",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          action: "reset",
          email: email.toLowerCase(),
          code,
          newPassword,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Помилка зміни паролю");
      }

      toast({
        title: "Успіх!",
        description: "Пароль успішно змінено. Увійдіть з новим паролем.",
        duration: 3000,
      });

      // Reset form and close dialog
      setEmail("");
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("email");
      onOpenChange(false);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося змінити пароль",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setStep("email");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Відновлення паролю</DialogTitle>
          <DialogDescription>
            {step === "email" && "Введіть ваш email для отримання коду"}
            {step === "code" && "Введіть 6-значний код з email"}
            {step === "password" && "Введіть новий пароль"}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-background/60"
                required
                autoFocus
              />
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
                type="submit"
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? "Відправка..." : "Отримати код"}
              </Button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code" className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Код підтвердження
              </Label>
              <Input
                id="reset-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="bg-background/60 text-center text-2xl tracking-widest"
                maxLength={6}
                required
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
                onClick={() => setStep("email")}
                className="flex-1"
                disabled={isLoading}
              >
                Назад
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? "Перевірка..." : "Підтвердити"}
              </Button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Новий пароль
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/60"
                minLength={6}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Повторіть пароль
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/60"
                minLength={6}
                required
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Паролі не співпадають</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("code")}
                className="flex-1"
                disabled={isLoading}
              >
                Назад
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? "Збереження..." : "Змінити пароль"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
