import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Upload, Check, X, ClipboardList, Crown } from "lucide-react";
import { useState, useEffect } from "react";
import { MyTaskSubmissionDialog } from "./MyTaskSubmissionDialog";
import { SubmitTaskDialog } from "./SubmitTaskDialog";
import { differenceInMinutes, addHours } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const statusLabels: Record<string, { label: string; variant: any }> = {
  in_progress: { label: "В процесі", variant: "secondary" },
  submitted: { label: "Очікує перевірки", variant: "default" },
  approved: { label: "Схвалено", variant: "default" },
  rejected: { label: "Відхилено", variant: "destructive" },
  revision_requested: { label: "На доопрацювання", variant: "secondary" },
};

const categoryLabels: Record<string, string> = {
  telegram_subscription: "Telegram підписка",
  like: "Лайк",
  comment: "Коментар",
  share: "Репост",
  survey: "Опитування",
  review: "Відгук",
  other: "Інше",
  bonus: "Бонусне завдання",
  vip: "VIP завдання",
  subscription: "Підписка",
  follow: "Підписатись",
  repost: "Репост",
};

export const MySubmissionsList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [submitDialogTask, setSubmitDialogTask] = useState<any>(null);
  const [, setTick] = useState(0);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("task_submissions")
        .select(`
          *,
          tasks (
            id,
            title,
            description,
            reward_amount,
            task_type,
            time_limit_hours,
            requires_screenshot
          )
        `)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);

  const getTimeRemaining = (startedAt: string, timeLimitHours: number) => {
    const deadline = addHours(new Date(startedAt), timeLimitHours);
    const now = new Date();
    const minutesLeft = differenceInMinutes(deadline, now);
    
    if (minutesLeft <= 0) return { text: "Час вийшов", expired: true };
    
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    
    return { text: `${hours}г ${minutes}хв`, expired: false };
  };

  const cancelSubmissionMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("task_submissions")
        .delete()
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Завдання скасовано",
        description: "Ви відмовились від виконання завдання",
      });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось скасувати завдання",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ви ще не взяли жодного завдання</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {submissions.map((submission: any) => {
          const task = submission.tasks;
          const timeInfo = submission.status === "in_progress" 
            ? getTimeRemaining(submission.started_at, task.time_limit_hours)
            : null;
          const taskImage = task.images && task.images.length > 0 ? task.images[0] : null;

          return (
            <Card 
              key={submission.id}
              className="overflow-hidden hover:shadow-lg transition-all"
            >
              {/* Task Image */}
              <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                {taskImage ? (
                  <img 
                    src={taskImage} 
                    alt={task.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ClipboardList className="w-16 h-16 text-primary/30" />
                )}
                
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  <Badge variant={statusLabels[submission.status]?.variant}>
                    {statusLabels[submission.status]?.label}
                  </Badge>
                </div>
              </div>

              <CardHeader className="space-y-3">
                {/* Timer & Reward */}
                <div className="flex items-center justify-between gap-2">
                  {timeInfo ? (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 ${
                      timeInfo.expired 
                        ? 'bg-red-50 dark:bg-red-950 border-red-500' 
                        : 'bg-blue-50 dark:bg-blue-950 border-blue-500'
                    }`}>
                      <Clock className={`w-4 h-4 ${timeInfo.expired ? 'text-red-600' : 'text-blue-600'}`} />
                      <span className={`text-sm font-bold ${timeInfo.expired ? 'text-red-600' : 'text-blue-600'}`}>
                        {timeInfo.text}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                  
                  <Badge variant="default" className="text-xs font-bold">
                    {task.reward_amount.toFixed(2)} ₴
                  </Badge>
                </div>

                {/* Category */}
                {task.category && (
                  <Badge variant="outline" className="w-fit text-xs">
                    {categoryLabels[task.category] || task.category}
                  </Badge>
                )}

                {/* Title */}
                <CardTitle 
                  className="line-clamp-2 text-base leading-tight cursor-pointer hover:text-primary"
                  onClick={() => setSelectedSubmission({ ...submission, task })}
                >
                  {task.title}
                </CardTitle>
                
                {/* Description */}
                <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                  {task.description}
                </CardDescription>

                {/* Action Buttons */}
                {submission.status === "in_progress" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubmitDialogTask({ ...task, submission });
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Здати
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Ви впевнені що хочете скасувати виконання?")) {
                          cancelSubmissionMutation.mutate(submission.id);
                        }
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {selectedSubmission && (
        <MyTaskSubmissionDialog
          submission={selectedSubmission}
          open={!!selectedSubmission}
          onOpenChange={(open) => !open && setSelectedSubmission(null)}
        />
      )}

      {submitDialogTask && (
        <SubmitTaskDialog
          task={submitDialogTask}
          submission={submitDialogTask.submission}
          open={!!submitDialogTask}
          onOpenChange={(open) => !open && setSubmitDialogTask(null)}
        />
      )}
    </>
  );
};