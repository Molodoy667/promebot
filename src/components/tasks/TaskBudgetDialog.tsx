import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskBudgetDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBalance: number;
  userBonusBalance: number;
}

export const TaskBudgetDialog = ({ task, open, onOpenChange, userBalance, userBonusBalance }: TaskBudgetDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"add" | "withdraw">("add");

  const calculateExecutions = (amount: number) => {
    return Math.floor(amount / task.reward_amount);
  };

  const addBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const rpcFunction = task.balance_type === 'main' 
        ? 'add_task_budget_from_main' 
        : 'add_task_budget_from_bonus';
      
      const { error } = await supabase.rpc(rpcFunction, {
        task_id_param: task.id,
        amount: amount,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      const balanceType = task.balance_type === 'main' ? 'основний' : 'бонусний';
      toast({ title: "������", description: `������ ������ ��������� � ${balanceType} �������!` });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setAmount("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "�������",
        description: error.message || "������� ���������� �������",
        variant: "destructive",
      });
    },
  });

  const withdrawBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      const rpcFunction = task.balance_type === 'main'
        ? 'withdraw_task_budget_to_main'
        : 'withdraw_task_budget';
      
      const { error } = await supabase.rpc(rpcFunction, {
        task_id_param: task.id,
        amount: amount,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      const balanceType = task.balance_type === 'main' ? '��������' : '��������';
      toast({ title: "������", description: `����� ������ ��������� �� ${balanceType} ������!` });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setAmount("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "�������",
        description: error.message || "������� ��������� �����",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    const minAmount = task.reward_amount; // ̳���� - ���� 1 ���������
    
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "�������", description: "������ �������� ����", variant: "destructive" });
      return;
    }

    if (activeTab === "add") {
      if (numAmount < minAmount) {
        toast({ title: "�������", description: `̳������� ���� ����������: ${minAmount.toFixed(2)} ₴ (���� 1 ���������)`, variant: "destructive" });
        return;
      }
      const availableBalance = task.balance_type === 'main' ? userBalance : userBonusBalance;
      if (numAmount > availableBalance) {
        const balanceTypeName = task.balance_type === 'main' ? 'основному' : 'бонусному';
        toast({ title: "�������", description: `����������� ����� �� ${balanceTypeName} ������`, variant: "destructive" });
        return;
      }
      addBudgetMutation.mutate(numAmount);
    } else {
      const maxWithdrawAmount = Math.max(0, task.budget - task.reward_amount);
      if (numAmount > maxWithdrawAmount) {
        toast({ title: "�������", description: `����� ������� �������� ${maxWithdrawAmount.toFixed(2)} ₴ (������� �������� �� 1 ���������)`, variant: "destructive" });
        return;
      }
      withdrawBudgetMutation.mutate(numAmount);
    }
  };

  const currentExecutions = calculateExecutions(parseFloat(amount) || 0);
  const maxWithdraw = Math.max(0, (task.budget || 0) - task.reward_amount); // �������� ����� �� 1 ���������

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>��������� �������� ��������</DialogTitle>
          <DialogDescription>
            �������� ������ �������� ��� ������� ����� ����� �� ������
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "add" | "withdraw")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">
              <TrendingUp className="h-4 w-4 mr-2" />
              ���������
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <TrendingDown className="h-4 w-4 mr-2" />
              �������
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-2 border-primary">
                <span className="text-muted-foreground font-medium">
                  {task.balance_type === 'main' ? '�������� ������:' : '�������� ��lan�:'}
                </span>
                <span className="font-bold text-lg text-primary">
                  {task.balance_type === 'main' ? userBalance.toFixed(2) : userBonusBalance.toFixed(2)} ₴
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">�������� ������:</span>
                <span className="font-semibold">{task.budget?.toFixed(2) || "0.00"} ₴</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ֳ�� �� ���������:</span>
                <span className="font-semibold">{task.reward_amount.toFixed(2)} ₴</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-amount">
                Сума поповнення з {task.balance_type === 'main' ? 'основного' : 'бонусного'} балансу (₴)
              </Label>
              <Input
                id="add-amount"
                type="text"
                placeholder={`̳���� ${task.reward_amount.toFixed(2)} ₴`}
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || !isNaN(parseFloat(value))) {
                    setAmount(value);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                ̳������� ����: <strong>{task.reward_amount.toFixed(2)} ₴</strong> (���� 1 ���������)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(task.reward_amount.toFixed(2))}
                  disabled={userBonusBalance < task.reward_amount}
                >
                  1 ���������
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((task.reward_amount * 5).toFixed(2))}
                  disabled={userBonusBalance < task.reward_amount * 5}
                >
                  5 ��������
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((task.reward_amount * 10).toFixed(2))}
                  disabled={userBonusBalance < task.reward_amount * 10}
                >
                  10 ��������
                </Button>
              </div>
              {amount && currentExecutions > 0 && (
                <p className="text-sm text-primary">
                  �� �� ���� ����� �������� <strong>{currentExecutions}</strong> ��������
                </p>
              )}
            </div>

            <div className="bg-primary/5 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Wallet className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">ϳ��� ����������:</p>
                  <p className="text-muted-foreground">
                    ������: {((task.budget || 0) + (parseFloat(amount) || 0)).toFixed(2)} ₴
                  </p>
                  <p className="text-muted-foreground">
                    ��������� ��������: {(task.available_executions || 0) + currentExecutions}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">�������� ������:</span>
                <span className="font-semibold">{(task.budget || 0).toFixed(2)} ₴</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">��������� ��������:</span>
                <span className="font-semibold">{task.available_executions || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">�������� ��� ���������:</span>
                <span className="font-semibold text-primary">{maxWithdraw.toFixed(2)} ₴</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">���� ��������� (₴)</Label>
              <Input
                id="withdraw-amount"
                type="text"
                placeholder={maxWithdraw > 0 ? "Введіть суму" : "Недостатньо коштів"}
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || !isNaN(parseFloat(value))) {
                    setAmount(value);
                  }
                }}
                disabled={maxWithdraw <= 0}
              />
              <p className="text-xs text-muted-foreground">
                ������� �������� ����� <strong>{task.reward_amount.toFixed(2)} ₴</strong> �� 1 ���������
              </p>
              {maxWithdraw > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((maxWithdraw / 2).toFixed(2))}
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(maxWithdraw.toFixed(2))}
                  >
                    ��������
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                ₴₴ ����� ���� ��������� �� ��� �������� ������. �������� ���������� ��������� � ����� 1 ����������.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ���������
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              addBudgetMutation.isPending ||
              withdrawBudgetMutation.isPending
            }
          >
            {addBudgetMutation.isPending || withdrawBudgetMutation.isPending
              ? "Обробка..."
              : activeTab === "add"
              ? "Поповнити"
              : "Вивести"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};






