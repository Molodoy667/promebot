import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, TrendingUp, TrendingDown } from "lucide-react";

interface TaskBudgetDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBalance?: number;
  userBonusBalance?: number;
}

export const TaskBudgetDialog = ({
  task,
  open,
  onOpenChange,
  userBalance = 0,
  userBonusBalance = 0,
}: TaskBudgetDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const addBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(task.balance_type === "main" ? "balance" : "bonus_balance")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const currentBalance = task.balance_type === "main" ? profile.balance : profile.bonus_balance;

      if (currentBalance < amount) {
        throw new Error("Insufficient balance");
      }

      const { error: deductError } = await supabase
        .from("profiles")
        .update({
          [task.balance_type === "main" ? "balance" : "bonus_balance"]: currentBalance - amount
        })
        .eq("id", user.id);

      if (deductError) throw deductError;

      const { error: budgetError } = await supabase
        .from("tasks")
        .update({
          budget: (task.budget || 0) + amount
        })
        .eq("id", task.id);

      if (budgetError) throw budgetError;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Бюджет поповнено" });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setDepositAmount("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message === "Insufficient balance") {
        toast({
          title: "Недостатньо коштів",
          description: "На вашому балансі недостатньо коштів",
          variant: "destructive",
        });
      } else {
        toast({ title: "Помилка", description: error.message, variant: "destructive" });
      }
    },
  });

  const withdrawBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if ((task.budget || 0) < amount) {
        throw new Error("Insufficient task budget");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(task.balance_type === "main" ? "balance" : "bonus_balance")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const currentBalance = task.balance_type === "main" ? profile.balance : profile.bonus_balance;

      const { error: returnError } = await supabase
        .from("profiles")
        .update({
          [task.balance_type === "main" ? "balance" : "bonus_balance"]: currentBalance + amount
        })
        .eq("id", user.id);

      if (returnError) throw returnError;

      const { error: budgetError } = await supabase
        .from("tasks")
        .update({
          budget: (task.budget || 0) - amount
        })
        .eq("id", task.id);

      if (budgetError) throw budgetError;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Кошти повернуто на баланс" });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setWithdrawAmount("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message === "Insufficient task budget") {
        toast({
          title: "Недостатньо коштів",
          description: "У бюджеті завдання недостатньо коштів",
          variant: "destructive",
        });
      } else {
        toast({ title: "Помилка", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Помилка", description: "Введіть коректну суму", variant: "destructive" });
      return;
    }
    addBudgetMutation.mutate(amount);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Помилка", description: "Введіть коректну суму", variant: "destructive" });
      return;
    }
    if (amount > (task.budget || 0)) {
      toast({ title: "Помилка", description: "Сума перевищує доступний бюджет", variant: "destructive" });
      return;
    }
    withdrawBudgetMutation.mutate(amount);
  };

  const quickDepositAmounts = [1, 5, 10];
  const quickWithdrawAmounts = [1, 5, 10];
  const availableExecutions = task.reward_amount > 0 ? Math.floor((task.budget || 0) / task.reward_amount) : 0;
  const currentUserBalance = task.balance_type === "main" ? userBalance : userBonusBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Управління бюджетом завдання</DialogTitle>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Поточний бюджет:</span>
                <strong>{(task.budget || 0).toFixed(2)} ₴</strong>
              </div>
              <div className="flex justify-between">
                <span>Винагорода за виконання:</span>
                <strong>{task.reward_amount.toFixed(2)} ₴</strong>
              </div>
              <div className="flex justify-between">
                <span>Доступно виконань:</span>
                <strong>{availableExecutions}</strong>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span>Ваш баланс:</span>
                <strong>{currentUserBalance.toFixed(2)} ₴</strong>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">
              <TrendingUp className="w-4 h-4 mr-2" />
              Додати
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <TrendingDown className="w-4 h-4 mr-2" />
              Зняти
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4">
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">
                  Сума поповнення з {task.balance_type === "main" ? "основного" : "бонусного"} балансу (₴)
                </Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.25"
                />
              </div>

              <div>
                <Label>
                  Швидке поповнення: {depositAmount ? `${depositAmount} ₴ (буде ${parseFloat(depositAmount) > 0 ? Math.floor(parseFloat(depositAmount) / task.reward_amount) : 0} виконань)` : ""}
                </Label>
                <div className="flex gap-2 mt-2">
                  {quickDepositAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      onClick={() => setDepositAmount(amount.toString())}
                      className="flex-1"
                    >
                      {amount} ₴
                    </Button>
                  ))}
                </div>
              </div>

              {depositAmount && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Після поповнення:
                    <div className="mt-1 space-y-0.5">
                      <div><strong>Бюджет: {((task.budget || 0) + parseFloat(depositAmount)).toFixed(2)} ₴</strong></div>
                      <div><strong>Доступно виконань: {Math.floor(((task.budget || 0) + parseFloat(depositAmount)) / task.reward_amount)}</strong></div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={addBudgetMutation.isPending}>
                {addBudgetMutation.isPending ? "Поповнення..." : "Поповнити"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <Label htmlFor="withdraw-amount">
                  Сума зняття на {task.balance_type === "main" ? "основний" : "бонусний"} баланс (₴)
                </Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={task.budget || 0}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.25"
                />
              </div>

              <div>
                <Label>Швидке зняття:</Label>
                <div className="flex gap-2 mt-2">
                  {quickWithdrawAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      onClick={() => setWithdrawAmount(Math.min(amount, task.budget || 0).toString())}
                      disabled={(task.budget || 0) < amount}
                      className="flex-1"
                    >
                      {amount} ₴
                    </Button>
                  ))}
                </div>
              </div>

              {withdrawAmount && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Після зняття:
                    <div className="mt-1 space-y-0.5">
                      <div><strong>Бюджет: {Math.max(0, (task.budget || 0) - parseFloat(withdrawAmount)).toFixed(2)} ₴</strong></div>
                      <div><strong>Доступно виконань: {Math.floor(Math.max(0, (task.budget || 0) - parseFloat(withdrawAmount)) / task.reward_amount)}</strong></div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                variant="destructive"
                disabled={withdrawBudgetMutation.isPending || (task.budget || 0) === 0}
              >
                {withdrawBudgetMutation.isPending ? "Зняття..." : "Зняти кошти"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
