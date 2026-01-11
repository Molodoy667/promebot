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
      
      // Створюємо транзакцію
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: 'task_budget',
          amount: -amount,
          status: 'completed',
          description: `Поповнення бюджету завдання "${task.title}"`,
          metadata: {
            task_id: task.id,
            task_title: task.title,
            balance_type: task.balance_type
          }
        });
      
      if (transactionError) console.error('Transaction error:', transactionError);
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

      const newBudget = (task.budget || 0) - amount;
      
      // Якщо бюджет стає 0 - деактивуємо завдання
      const updateData: any = {
        budget: newBudget
      };
      
      if (newBudget === 0) {
        updateData.status = 'inactive';
      }
      
      const { error: budgetError } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", task.id);

      if (budgetError) throw budgetError;
      
      // Створюємо транзакцію
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: 'task_budget_withdrawal',
          amount: amount,
          status: 'completed',
          description: `Виведення з бюджету завдання "${task.title}"`,
          metadata: {
            task_id: task.id,
            task_title: task.title,
            balance_type: task.balance_type,
            budget_became_zero: newBudget === 0
          }
        });
      
      if (transactionError) console.error('Transaction error:', transactionError);
      
      return { budgetBecameZero: newBudget === 0 };
    },
    onSuccess: (data: any) => {
      if (data?.budgetBecameZero) {
        toast({ 
          title: "Успішно", 
          description: "Кошти повернуто на баланс. Завдання деактивовано через нульовий бюджет.",
          duration: 5000
        });
      } else {
        toast({ title: "Успішно", description: "Кошти повернуто на баланс" });
      }
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
    if (amount < task.reward_amount) {
      toast({ 
        title: "Помилка", 
        description: `Мінімальна сума ${task.reward_amount}₴ (1 виконання)`,
        variant: "destructive" 
      });
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

  const quickDepositAmounts = [
    { label: '5 виконань', amount: task.reward_amount * 5 },
    { label: '10 виконань', amount: task.reward_amount * 10 },
    { label: '50 виконань', amount: task.reward_amount * 50 },
    { label: '100 виконань', amount: task.reward_amount * 100 }
  ];
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
              Поповнити
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <TrendingDown className="w-4 h-4 mr-2" />
              Вивести
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
                  min={task.reward_amount}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={task.reward_amount.toFixed(2)}
                  className={parseFloat(depositAmount) > 0 && parseFloat(depositAmount) < task.reward_amount ? 'border-destructive' : ''}
                />
                {parseFloat(depositAmount) > 0 && parseFloat(depositAmount) < task.reward_amount && (
                  <p className="text-xs text-destructive mt-1">
                    Мінімум {task.reward_amount}₴ (1 виконання)
                  </p>
                )}
              </div>

              <div>
                <Label>
                  Швидке поповнення: {depositAmount ? `${depositAmount} ₴ (буде ${parseFloat(depositAmount) > 0 ? Math.floor(parseFloat(depositAmount) / task.reward_amount) : 0} виконань)` : ""}
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {quickDepositAmounts.map(({ label, amount }) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      onClick={() => setDepositAmount(amount.toString())}
                      className="flex flex-col h-auto py-2"
                    >
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="font-bold">{amount.toFixed(2)} ₴</span>
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

              <Button 
                type="submit" 
                className="w-full" 
                disabled={
                  addBudgetMutation.isPending || 
                  parseFloat(depositAmount) > currentUserBalance ||
                  parseFloat(depositAmount) < task.reward_amount ||
                  !depositAmount
                }
              >
                {addBudgetMutation.isPending ? "Поповнення..." : "Поповнити"}
              </Button>
              {parseFloat(depositAmount) > currentUserBalance && (
                <p className="text-xs text-destructive text-center">
                  Недостатньо коштів на балансі
                </p>
              )}
            </form>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <Label htmlFor="withdraw-amount">
                  Сума виведення на {task.balance_type === "main" ? "основний" : "бонусний"} баланс (₴)
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
                <Label>Швидке виведення:</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWithdrawAmount((task.budget || 0).toString())}
                    disabled={(task.budget || 0) === 0}
                    className="flex-1"
                  >
                    Все ({(task.budget || 0).toFixed(2)} ₴)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWithdrawAmount(((task.budget || 0) / 2).toString())}
                    disabled={(task.budget || 0) < 0.02}
                    className="flex-1"
                  >
                    Половина
                  </Button>
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
                disabled={
                  withdrawBudgetMutation.isPending || 
                  (task.budget || 0) === 0 ||
                  parseFloat(withdrawAmount) > (task.budget || 0) ||
                  !withdrawAmount
                }
              >
                {withdrawBudgetMutation.isPending ? "Виведення..." : "Вивести кошти"}
              </Button>
              {parseFloat(withdrawAmount) > (task.budget || 0) && (
                <p className="text-xs text-destructive text-center">
                  Недостатньо коштів у бюджеті завдання
                </p>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
