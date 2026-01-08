import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { differenceInMinutes, addHours } from "date-fns";

interface MyTaskSubmissionDialogProps {
  submission: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MyTaskSubmissionDialog = ({ submission, open, onOpenChange }: MyTaskSubmissionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const task = submission?.task;

  const getTimeRemaining = () => {
    if (!submission || submission.status !== "in_progress") return null;
    const deadline = addHours(new Date(submission.started_at), task.time_limit_hours);
    const now = new Date();
    const minutesLeft = differenceInMinutes(deadline, now);
    
    if (minutesLeft <= 0) return "Час вийшов";
    
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    
    return `${hours}г ${minutes}хв`;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("task_submissions")
        .update({ 
          status: "submitted",
          submitted_at: new Date().toISOString()
        })
        .eq("id", submission.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Завдання відправлено на перевірку" });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      // Delete submission to return task to available
      const { error } = await supabase
        .from("task_submissions")
        .delete()
        .eq("id", submission.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Завдання повернуто в доступні" });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  if (!submission || !task) return null;

  const timeRemaining = getTimeRemaining();
  const isExpired = timeRemaining === "Час вийшов";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task info */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Винагорода:</span>
              <span className="text-lg font-bold text-primary">{task.reward_amount.toFixed(2)} ₴</span>
            </div>

            {timeRemaining && (
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Залишилось часу:
                </span>
                <span className={`font-bold ${isExpired ? 'text-destructive' : ''}`}>
                  {timeRemaining}
                </span>
              </div>
            )}

            <div>
              <p className="font-semibold mb-2">Опис завдання:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>

            {task.requires_screenshot && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  📸 Для цього завдання потрібен скріншот
                </p>
              </div>
            )}

            {submission.review_comment && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200">
                <p className="font-semibold mb-1 text-orange-900 dark:text-orange-100">Коментар:</p>
                <p className="text-sm text-orange-700 dark:text-orange-300">{submission.review_comment}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {submission.status === "in_progress" && !isExpired && (
            <div className="flex gap-3">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Відправка..." : "Виконав"}
              </Button>
              <Button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {cancelMutation.isPending ? "Скасування..." : "Відхилити"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
