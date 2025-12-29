import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, Phone, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserbotAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spyId: string;
  spyName: string;
  phoneNumber: string | null;
  onSuccess?: () => void;
}

export const UserbotAuthDialog = ({ 
  open, 
  onOpenChange, 
  spyId, 
  spyName, 
  phoneNumber,
  onSuccess 
}: UserbotAuthDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'send_code' | 'enter_code'>('send_code');
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState(phoneNumber || '');
  const [code, setCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');

  const handleSendCode = async () => {
    if (!phone) {
      toast({
        title: "Помилка",
        description: "Введіть номер телефону",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('authorize-userbot', {
        body: {
          spyId,
          phoneNumber: phone,
          action: 'send_code'
        }
      });

      if (error) throw error;

      setPhoneCodeHash(data.phoneCodeHash);
      setStep('enter_code');

      toast({
        title: "✅ Код надіслано!",
        description: "Перевірте ваш Telegram і введіть код",
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error sending code:', error);
      toast({
        title: "❌ Помилка",
        description: error.message || "Не вдалося надіслати код",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!code || code.length < 5) {
      toast({
        title: "Помилка",
        description: "Введіть правильний код (5 цифр)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log('[UserbotAuth] Starting sign_in with:', { spyId, phone, hasCode: !!code, hasHash: !!phoneCodeHash });
    
    try {
      const { data, error } = await supabase.functions.invoke('authorize-userbot', {
        body: {
          spyId,
          phoneNumber: phone,
          phoneCode: code,
          phoneCodeHash: phoneCodeHash,
          action: 'sign_in'
        }
      });

      console.log('[UserbotAuth] Edge function response:', { data, error });

      if (error) {
        console.error('[UserbotAuth] Edge function error:', error);
        toast({
          title: "Помилка авторизації",
          description: error.message || "Невідома помилка",
          variant: "destructive",
        });
        throw error;
      }

      if (data?.error) {
        console.error('[UserbotAuth] Data error:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: "🎉 Авторизація успішна!",
        description: `Userbot "${spyName}" готовий до роботи`,
        duration: 3000,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      // Показати детальну помилку
      let errorMsg = error.message || "Не вдалося авторизуватися";
      
      if (errorMsg.includes('PHONE_CODE_INVALID')) {
        errorMsg = "Невірний код. Спробуйте ще раз або надішліть новий код.";
      } else if (errorMsg.includes('SESSION_PASSWORD_NEEDED')) {
        errorMsg = "Акаунт має 2FA. Спочатку вимкніть двофакторну автентифікацію в Telegram.";
      } else if (errorMsg.includes('PHONE_CODE_EXPIRED')) {
        errorMsg = "Код застарів. Надішліть новий код.";
        setStep('send_code');
      }

      toast({
        title: "❌ Помилка авторизації",
        description: errorMsg,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('send_code');
    setCode('');
    setPhoneCodeHash('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-500" />
            Авторизація Userbot
          </DialogTitle>
          <DialogDescription>
            Авторизуйте "{spyName}" для доступу до Telegram API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'send_code' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Номер телефону
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380123456789"
                  className="font-mono"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Формат: +380... (з кодом країни)
                </p>
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/20">
                <AlertDescription className="text-xs">
                  <strong>Як це працює:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Введіть ваш номер телефону</li>
                    <li>Натисніть "Надіслати код"</li>
                    <li>Отримаєте код в Telegram</li>
                    <li>Введіть код для завершення авторизації</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </>
          )}

          {step === 'enter_code' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Код підтвердження
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="12345"
                  maxLength={5}
                  className="font-mono text-center text-2xl tracking-widest"
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Введіть 5-значний код з Telegram
                </p>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  Код надіслано на номер: <strong className="font-mono">{phone}</strong>
                  <br />
                  Перевірте ваш Telegram (можливо в Saved Messages)
                </AlertDescription>
              </Alert>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
                className="w-full"
              >
                Надіслати новий код
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Скасувати
          </Button>
          
          {step === 'send_code' ? (
            <Button onClick={handleSendCode} disabled={isLoading || !phone}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Надіслати код
            </Button>
          ) : (
            <Button onClick={handleSignIn} disabled={isLoading || code.length < 5}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Авторизуватися
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
