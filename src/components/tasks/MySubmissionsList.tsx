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
  const [activeTab, setActiveTab] = useState("all");
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
            requires_screenshot,
            balance_type,
            category,
            images,
            telegram_channel_link,
            channel_info,
            user_id
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

  // Filter submissions by tab
  const filteredSubmissions = submissions.filter((submission: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "in_progress") return submission.status === "in_progress";
    if (activeTab === "submitted") return submission.status === "submitted";
    if (activeTab === "approved") return submission.status === "approved";
    if (activeTab === "rejected") return submission.status === "rejected";
    return true;
  });

  // Calculate counts by status
  const statusCounts = {
    all: submissions.length,
    in_progress: submissions.filter((s: any) => s.status === "in_progress").length,
    submitted: submissions.filter((s: any) => s.status === "submitted").length,
    approved: submissions.filter((s: any) => s.status === "approved").length,
    rejected: submissions.filter((s: any) => s.status === "rejected").length,
  };

  return (
    <>
      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          size="sm"
          variant={activeTab === "all" ? "default" : "outline"}
          onClick={() => setActiveTab("all")}
        >
          Всі <Badge variant="secondary" className="ml-2">{statusCounts.all}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "in_progress" ? "default" : "outline"}
          onClick={() => setActiveTab("in_progress")}
        >
          Виконується <Badge variant="secondary" className="ml-2">{statusCounts.in_progress}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "submitted" ? "default" : "outline"}
          onClick={() => setActiveTab("submitted")}
        >
          На перевірці <Badge variant="secondary" className="ml-2">{statusCounts.submitted}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "approved" ? "default" : "outline"}
          onClick={() => setActiveTab("approved")}
        >
          Виконано <Badge variant="secondary" className="ml-2">{statusCounts.approved}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "rejected" ? "default" : "outline"}
          onClick={() => setActiveTab("rejected")}
        >
          Відхилено <Badge variant="secondary" className="ml-2">{statusCounts.rejected}</Badge>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSubmissions.map((submission: any) => {
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
              <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
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

                {/* Balance Type Badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant={task.balance_type === "main" ? "default" : "secondary"}>
                    {task.balance_type === "main" ? "Баланс" : "Бонусне"}
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

                {/* Task Image - moved from top */}
                {!taskImage && task.images && task.images.length > 0 && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-primary/20">
                    <img 
                      src={task.images[0]} 
                      alt={task.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

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