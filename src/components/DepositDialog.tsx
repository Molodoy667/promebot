import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentBalance: number;
  onSuccess: () => void;
}

export const DepositDialog = ({ open, onOpenChange, userId, currentBalance, onSuccess }: DepositDialogProps) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);
    
    if (!depositAmount || depositAmount <= 0) {
      toast({
        title: "Помилка",
        description: "Введіть коректну суму для поповнення",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    setIsProcessing(true);

    try {
      // В реальному проекті тут буде інтеграція з платіжною системою
      // Наразі просто додаємо суму до балансу
      const newBalance = currentBalance + depositAmount;

      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", userId);

      if (balanceError) throw balanceError;

      // Створити транзакцію про поповнення
      await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "deposit",
          amount: depositAmount,
          description: `Поповнення балансу на ${depositAmount.toFixed(2)} ₴`,
          status: "completed",
        });

      toast({
        title: "Успішно!",
        description: `Баланс поповнено на ${depositAmount.toFixed(2)} ₴`,
        duration: 1500,
      });

      setAmount("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося поповнити баланс",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const quickAmounts = [50, 100, 200, 500];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Поповнити баланс</DialogTitle>
          <DialogDescription>
            Виберіть суму або введіть власну
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((quickAmount) => (
              <Button
                key={quickAmount}
                variant="outline"
                onClick={() => setAmount(quickAmount.toString())}
                className="h-12"
              >
                {quickAmount} ₴
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Сума поповнення</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="Введіть суму"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Поточний баланс: <span className="font-semibold">{currentBalance.toFixed(2)} ₴</span>
            </p>
            {amount && parseFloat(amount) > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Новий баланс: <span className="font-semibold text-primary">
                  {(currentBalance + parseFloat(amount)).toFixed(2)} ₴
                </span>
              </p>
            )}
          </div>

          <Button 
            onClick={handleDeposit} 
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Обробка...
              </>
            ) : (
              "Поповнити"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            * Для тесту поповнення відбувається миттєво. 
            В реальному проекті буде інтеграція з платіжною системою.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
