import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle } from "lucide-react";

interface EditRewardDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditRewardDialog = ({ task, open, onOpenChange }: EditRewardDialogProps) => {
  const [newReward, setNewReward] = useState(task.reward_amount.toString());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRewardMutation = useMutation({
    mutationFn: async (newAmount: number) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          reward_amount: newAmount,
          status: 'inactive' // Деактивуємо завдання
        })
        .eq("id", task.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Винагороду змінено",
        description: "Завдання деактивовано. Запустіть його знову після перевірки.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newReward);
    
    if (isNaN(amount) || amount < 1 || amount > 100) {
      toast({
        title: "Помилка",
        description: "Винагорода має бути від 1 до 100 грн",
        variant: "destructive",
      });
      return;
    }

    updateRewardMutation.mutate(amount);
  };

  const amount = parseFloat(newReward);
  const isValid = !isNaN(amount) && amount >= 1 && amount <= 100;
  const hasError = !isNaN(amount) && (amount < 1 || amount > 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Змінити винагороду</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reward">Нова винагорода (₴)</Label>
            <Input
              id="reward"
              type="number"
              step="0.01"
              min="1"
              max="100"
              value={newReward}
              onChange={(e) => setNewReward(e.target.value)}
              className={hasError ? 'border-destructive' : ''}
              placeholder="1.00"
            />
            
            {hasError && amount < 1 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Мінімальна винагорода 1 грн
              </p>
            )}
            
            {hasError && amount > 100 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Максимальна винагорода 100 грн
              </p>
            )}
            
            {!hasError && (
              <p className="text-xs text-muted-foreground">
                Поточна винагорода: {task.reward_amount.toFixed(2)} ₴
              </p>
            )}
          </div>

          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-xs text-warning font-medium">
              ⚠️ Після зміни винагороди завдання буде деактивовано. Вам потрібно буде запустити його знову.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button 
              type="submit" 
              disabled={updateRewardMutation.isPending || !isValid}
            >
              {updateRewardMutation.isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
