import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, ClipboardList, BarChart3, DollarSign, Users, Camera } from "lucide-react";
import { differenceInMinutes, addHours } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

          {/* Additional Images */}
          {task.images && task.images.length > 1 && (
            <div>
              <h4 className="font-semibold mb-3 text-sm">📸 Додаткові зображення:</h4>
              <div className="grid grid-cols-3 gap-2">
                {task.images.slice(1).map((image: string, index: number) => (
                  <a 
                    key={index}
                    href={image}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-colors"
                  >
                    <img 
                      src={image} 
                      alt={`Image ${index + 2}`}
                      className="w-full h-24 object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Telegram Channel */}
          {task.telegram_channel_link && task.channel_info ? (
            <a 
              href={task.telegram_channel_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-blue-500/10 hover:bg-blue-500/20 p-4 rounded-lg border border-blue-500/20 transition-colors"
            >
              <h4 className="font-semibold mb-3 text-sm">📱 Telegram канал:</h4>
              <div className="flex items-center gap-3">
                {task.channel_info?.photo ? (
                  <img 
                    src={task.channel_info.photo} 
                    alt={task.channel_info.title || "Channel"}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 font-bold text-xl">
                    {task.channel_info?.title?.[0]?.toUpperCase() || "T"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">
                    {task.channel_info?.title || "Telegram Channel"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {task.channel_info?.username ? `@${task.channel_info.username}` : task.telegram_channel_link}
                  </p>
                  {task.channel_info?.participants_count && (
                    <p className="text-xs text-muted-foreground mt-1">
                      👥 {task.channel_info.participants_count.toLocaleString()} підписників
                    </p>
                  )}
                </div>
              </div>
            </a>
          ) : task.telegram_channel_link ? (
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
              <h4 className="font-semibold mb-2 text-sm">🔗 Посилання:</h4>
              <a 
                href={task.telegram_channel_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all text-sm"
              >
                {task.telegram_channel_link}
              </a>
            </div>
          ) : null}

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

              {timeRemaining && (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100 dark:bg-red-950' : 'bg-blue-100 dark:bg-blue-950'}`}>
                    <Clock className={`h-5 w-5 ${isExpired ? 'text-red-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Залишилось часу</p>
                    <p className={`font-semibold ${isExpired ? 'text-destructive' : ''}`}>{timeRemaining}</p>
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

          {submission.review_comment && (
            <Alert className="border-orange-500/50 bg-orange-500/5">
              <AlertDescription>
                <strong>Коментар модератора:</strong><br />
                {submission.review_comment}
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          {submission.status === "in_progress" && !isExpired && (
            <div className="flex gap-3">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Відправка..." : "Здати завдання"}
              </Button>
              <Button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {cancelMutation.isPending ? "Скасування..." : "Скасувати"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
