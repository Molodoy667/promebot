import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface TaskBudgetDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskBudgetDialog = ({ task, open, onOpenChange }: TaskBudgetDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const addBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check user balance
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(task.balance_type === "main" ? "balance" : "bonus_balance")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const userBalance = task.balance_type === "main" ? profile.balance : profile.bonus_balance;

      if (userBalance < amount) {
        throw new Error("Insufficient balance");
      }

      // Deduct from user balance
      const { error: deductError } = await supabase
        .from("profiles")
        .update({
          [task.balance_type === "main" ? "balance" : "bonus_balance"]: userBalance - amount
        })
        .eq("id", user.id);

      if (deductError) throw deductError;

      // Add to task budget
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
      setAmount("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message === "Insufficient balance") {
        toast({ 
          title: "Недостатньо коштів", 
          description: "На вашому балансі недостатньо коштів для поповнення",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Помилка", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Помилка", description: "Введіть коректну суму", variant: "destructive" });
      return;
    }
    addBudgetMutation.mutate(parsedAmount);
  };

  const quickAmounts = [1, 5, 10];
  const availableExecutions = task.reward_amount > 0 ? Math.floor((task.budget || 0) / task.reward_amount) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Поповнити бюджет завдання</DialogTitle>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div>Поточний бюджет: <strong>{(task.budget || 0).toFixed(2)} ₴</strong></div>
              <div>Винагорода за виконання: <strong>{task.reward_amount.toFixed(2)} ₴</strong></div>
              <div>Доступно виконань: <strong>{availableExecutions}</strong></div>
            </div>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Сума поповнення з {task.balance_type === "main" ? "основного" : "бонусного"} балансу (₴)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.25"
            />
          </div>

          <div>
            <Label>Швидке поповнення: {amount ? `${amount} ₴ (буде ${parseFloat(amount) > 0 ? Math.floor(parseFloat(amount) / task.reward_amount) : 0} виконань)` : ""}</Label>
            <div className="flex gap-2 mt-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(quickAmount.toString())}
                >
                  {quickAmount} ₴
                </Button>
              ))}
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Після поповнення:
              <div className="mt-1">
                <strong>Бюджет: {((task.budget || 0) + (parseFloat(amount) || 0)).toFixed(2)} ₴</strong>
              </div>
              <div>
                <strong>Доступно виконань: {parseFloat(amount) > 0 ? Math.floor(((task.budget || 0) + parseFloat(amount)) / task.reward_amount) : availableExecutions}</strong>
              </div>
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={addBudgetMutation.isPending}>
            {addBudgetMutation.isPending ? "Поповнення..." : "Поповнити"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
