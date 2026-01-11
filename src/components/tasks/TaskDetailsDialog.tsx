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
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Users, Camera, AlertCircle, ClipboardList, BarChart3, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TaskDetailsDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDetailsDialog = ({ task, open, onOpenChange }: TaskDetailsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);

  const startTaskMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("task_submissions")
        .insert({
          task_id: task.id,
          user_id: user.id,
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Завдання розпочато!",
        description: "Таймер запущено.",
      });
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось розпочати завдання",
        variant: "destructive",
      });
    },
  });

  const handleStartTask = async () => {
    setIsStarting(true);
    await startTaskMutation.mutateAsync();
    setIsStarting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {/* Task Image */}
          {task.images && task.images.length > 0 ? (
            <div className="mb-4 rounded-lg overflow-hidden">
              <img 
                src={task.images[0]} 
                alt={task.title}
                className="w-full h-48 object-cover"
              />
            </div>
          ) : (
            <div className="mb-4 h-48 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-20 h-20 text-primary/30" />
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <Badge variant={task.balance_type === "main" ? "default" : "secondary"}>
              {task.balance_type === "main" ? "Баланс" : "Бонусне"}
            </Badge>
            <span className="text-2xl font-bold text-primary">
              {task.reward_amount.toFixed(2)} ₴
            </span>
          </div>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <h4 className="font-semibold mb-2 text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Опис завдання:</h4>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-base flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Умови виконання:</h4>
            <div className="grid gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Час на виконання</p>
                  <p className="font-semibold">{task.time_limit_hours} годин</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Винагорода</p>
                  <p className="font-semibold text-primary">{task.reward_amount.toFixed(2)} ₴</p>
                </div>
              </div>

              {task.max_completions && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Обмеження</p>
                    <p className="font-semibold">1 користувач → 1 виконання</p>
                  </div>
                </div>
              )}

              {task.requires_screenshot && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                    <Camera className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Скріншот</p>
                    <p className="font-semibold text-orange-600">Обов'язковий</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Alert className="border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription>
              <strong>Важливо:</strong> Після натискання кнопки "Розпочати завдання" у вас буде <strong>{task.time_limit_hours} год</strong> на його виконання.
              Після закінчення часу завдання стане недоступним. Переконайтеся, що ви готові розпочати прямо зараз!
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрити
          </Button>
          {task.canTake !== false && !task.isOwner && (
            <Button onClick={handleStartTask} disabled={isStarting}>
              {isStarting ? "Початок..." : "Розпочати завдання"}
            </Button>
          )}
          {task.isOwner && (
            <Badge className="bg-yellow-500 text-white">
              <Crown className="w-3 h-3 mr-1" />
              Це ваше завдання
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
