import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Gift, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

interface ReferralCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const ReferralCodeDialog = ({ isOpen, onClose, userId }: ReferralCodeDialogProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [referralSettings, setReferralSettings] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadReferralSettings();
    }
  }, [isOpen]);

  const loadReferralSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "referral_config")
        .maybeSingle();

      if (data?.value) {
        setReferralSettings(data.value as any);
      } else {
        setReferralSettings({ referrer_bonus: 50, referee_bonus: 25 });
      }
    } catch (err) {
      console.error("Error loading referral settings:", err);
      setReferralSettings({ referrer_bonus: 50, referee_bonus: 25 });
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError("Введіть код");
      setStatus("error");
      setStatusMessage("Будь ласка, введіть код запрошення.");
      return;
    }
 
    if (code.length !== 8) {
      setError("Код має містити 8 символів");
      setStatus("error");
      setStatusMessage("Код має містити саме 8 символів.");
      return;
    }
 
    setIsSubmitting(true);
    setError("");
    setStatus("verifying");
    setStatusMessage("Перевіряємо код запрошення...");
    setProgress(30);
 
    try {
      const { data, error } = await supabase.rpc("apply_referral_code", {
        // Keep argument order consistent with DB function signature to avoid ambiguity
        p_referral_code: code.toUpperCase(),
        p_user_id: userId,
      });
 
      if (error) throw error;
 
      const result = Array.isArray(data) ? data[0] : data;
 
      setProgress(100);
 
      if (result.success) {
        setStatus("success");
        setStatusMessage(result.message || "Код успішно застосовано.");
      } else {
        setStatus("error");
        setStatusMessage(result.message || "Не вдалося застосувати код.");
        setError(result.message);
      }
    } catch (err: any) {
      console.error("Referral code error:", err);
      setStatus("error");
      setStatusMessage(err.message || "Помилка застосування коду");
      setError(err.message || "Помилка застосування коду");
      setProgress(100);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSkip = () => {
    // Mark as entered so dialog won't show again
    supabase
      .from('profiles')
      .update({ has_entered_referral: true })
      .eq('id', userId)
      .then(() => {
        setCode("");
        setError("");
        setProgress(0);
        setStatus("idle");
        setStatusMessage(null);
        onClose();
      });
  };
  const referrerBonus = referralSettings?.referrer_bonus || 50;
  const refereeBonus = referralSettings?.referee_bonus || 25;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Вітаємо!</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Введіть код запрошення та отримайте бонус
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Увага!</strong> Після закриття цього вікна ви більше не зможете ввести реферальний код.
            </AlertDescription>
          </Alert>

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="referral-code">Код запрошення (8 символів)</Label>
            <Input
              id="referral-code"
              placeholder="Наприклад: ABC12345"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
                setStatus("idle");
                setStatusMessage(null);
                setProgress(0);
              }}
              maxLength={8}
              className="text-center text-lg font-mono tracking-wider"
              disabled={isSubmitting || status === "success"}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Verification progress */}
          {(isSubmitting || status === "success" || status === "error") && (
            <div className="space-y-2">
              <Label>Статус перевірки</Label>
              <Progress value={isSubmitting && progress < 100 ? progress || 60 : 100} />
              {statusMessage && (
                <p
                  className={
                    "text-xs sm:text-sm " +
                    (status === "success" ? "text-green-600 dark:text-green-400" : "text-yellow-800 dark:text-yellow-200")
                  }
                >
                  {statusMessage}
                </p>
              )}
            </div>
          )}

          {/* Benefits */}
          <div className="rounded-lg p-4 space-y-2 bg-card/80 border border-border/60 shadow-card">
            <p className="text-sm font-semibold text-foreground">🎁 Що ви отримаєте:</p>
            <ul className="text-xs sm:text-sm space-y-1 text-muted-foreground">
              <li>✅ <strong>{refereeBonus}₴</strong> бонусів на ваш рахунок</li>
              <li>✅ Ваш запрошувач отримає <strong>{referrerBonus}₴</strong></li>
              <li>✅ Можна використати для оплати тарифів</li>
            </ul>
          </div>


          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="flex-1"
            >
              Пропустити
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || code.length !== 8}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Перевірка...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  Застосувати код
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
