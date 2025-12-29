import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, Clock, Coins, CheckCircle, XCircle, AlertCircle, TrendingUp, Calendar, RefreshCw, MessageCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SubmitTaskDialog } from "@/components/tasks/SubmitTaskDialog";
import { MyTasksList } from "@/components/tasks/MyTasksList";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TabType = "available" | "my-tasks" | "my-submissions";
type SubmissionFilterType = "all" | "in_progress" | "completed" | "rejected";

const TaskMarketplace = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("available");
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilterType>("all");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submissionToSubmit, setSubmissionToSubmit] = useState<any>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "my-tasks" || tabParam === "my-submissions" || tabParam === "available") {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  // Real-time updates for tasks and submissions
  useEffect(() => {
    // Tasks updates (for all tabs)
    const tasksChannel = supabase
      .channel('marketplace_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          console.log('Task changed, refreshing...');
          queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }
      )
      .subscribe();

    // Task submissions updates
    const submissionsChannel = supabase
      .channel('marketplace_submissions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_submissions',
        },
        () => {
          console.log('Submission changed, refreshing...');
          queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
          queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }
      )
      .subscribe();

    return () => {
      tasksChannel.unsubscribe();
      submissionsChannel.unsubscribe();
    };
  }, [queryClient]);

  // Fetch available tasks
  const { data: availableTasks, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("task_id")
        .eq("user_id", user.id);

      const submittedTaskIds = submissions?.map(s => s.task_id) || [];

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *
        `)
        .eq("status", "active")
        .not("user_id", "eq", user.id);

      if (error) throw error;
      
      return data?.filter(task => !submittedTaskIds.includes(task.id)) || [];
    },
    enabled: activeTab === "available",
  });

  // Fetch my tasks with submission counts
  const { data: myTasks, isLoading: loadingMyTasks } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_submissions (
            id,
            status
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "my-tasks",
  });

  // Fetch my submissions
  const { data: mySubmissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: ["my-submissions", submissionFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("task_submissions")
        .select(`
          *,
          tasks (
            title,
            description,
            reward_amount,
            task_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (submissionFilter !== "all") {
        query = query.eq("status", submissionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "my-submissions",
  });

  // Calculate submission stats
  const submissionStats = {
    all: mySubmissions?.length || 0,
    in_progress: mySubmissions?.filter(s => s.status === "in_progress").length || 0,
    completed: mySubmissions?.filter(s => s.status === "completed").length || 0,
    rejected: mySubmissions?.filter(s => s.status === "rejected").length || 0,
  };

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Успішно",
        description: "Завдання видалено",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setTaskToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось видалити завдання",
        variant: "destructive",
      });
    },
  });

  const handleStartTask = async (task: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Помилка",
          description: "Необхідно авторизуватись",
          variant: "destructive",
        });
        return;
      }

      // Create submission with in_progress status
      const { data: submission, error } = await supabase
        .from("task_submissions")
        .insert({
          task_id: task.id,
          user_id: user.id,
          status: "in_progress",
        })
        .select(`
          *,
          tasks (*)
        `)
        .single();

      if (error) throw error;

      setSubmissionToSubmit(submission);
      setSubmitDialogOpen(true);
      toast({
        title: "Завдання розпочато!",
        description: "Заповніть звіт після виконання.",
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось розпочати завдання",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <PageHeader
          icon={Briefcase}
          title="Біржа завдань"
          description="Створюйте завдання для користувачів та заробляйте виконуючи завдання інших"
        >
          <Button 
            onClick={() => navigate("/task-marketplace/create")}
            className="bg-gradient-primary hover:opacity-90 transition-all duration-300 hover:scale-105 shadow-lg mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Створити завдання
          </Button>
        </PageHeader>

        <div className="mb-6">
          {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-semibold">Доступно</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{availableTasks?.length || 0}</p>
              </div>

              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 hover:border-warning/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-warning mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-semibold">В роботі</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{submissionStats.in_progress}</p>
              </div>

              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-success mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-semibold">Виконано</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{submissionStats.completed}</p>
              </div>

              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-accent mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-semibold">Мої завдання</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{myTasks?.length || 0}</p>
              </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={activeTab === "available" ? "default" : "outline"}
            onClick={() => setActiveTab("available")}
            className={activeTab === "available" ? "bg-gradient-primary" : ""}
          >
            Доступні завдання
          </Button>
          <Button
            variant={activeTab === "my-tasks" ? "default" : "outline"}
            onClick={() => setActiveTab("my-tasks")}
            className={activeTab === "my-tasks" ? "bg-gradient-primary" : ""}
          >
            Мої завдання
          </Button>
          <Button
            variant={activeTab === "my-submissions" ? "default" : "outline"}
            onClick={() => setActiveTab("my-submissions")}
            className={activeTab === "my-submissions" ? "bg-gradient-primary" : ""}
          >
            Мої виконання
          </Button>
        </div>

        {/* Submission Filters */}
        {activeTab === "my-submissions" && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              size="sm"
              variant={submissionFilter === "all" ? "default" : "outline"}
              onClick={() => setSubmissionFilter("all")}
              className={submissionFilter === "all" ? "bg-gradient-primary" : ""}
            >
              Всі <Badge variant="secondary" className="ml-2">{submissionStats.all}</Badge>
            </Button>
            <Button
              size="sm"
              variant={submissionFilter === "in_progress" ? "default" : "outline"}
              onClick={() => setSubmissionFilter("in_progress")}
              className={submissionFilter === "in_progress" ? "bg-gradient-primary" : ""}
            >
              В роботі <Badge variant="secondary" className="ml-2">{submissionStats.in_progress}</Badge>
            </Button>
            <Button
              size="sm"
              variant={submissionFilter === "completed" ? "default" : "outline"}
              onClick={() => setSubmissionFilter("completed")}
              className={submissionFilter === "completed" ? "bg-gradient-primary" : ""}
            >
              Виконані <Badge variant="secondary" className="ml-2">{submissionStats.completed}</Badge>
            </Button>
            <Button
              size="sm"
              variant={submissionFilter === "rejected" ? "default" : "outline"}
              onClick={() => setSubmissionFilter("rejected")}
              className={submissionFilter === "rejected" ? "bg-gradient-primary" : ""}
            >
              Відхилені <Badge variant="secondary" className="ml-2">{submissionStats.rejected}</Badge>
            </Button>
          </div>
        )}

        {/* Content */}
        {activeTab === "available" && (
          <>
            {loadingAvailable ? (
              <Loading />
            ) : availableTasks && availableTasks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableTasks.map((task, index) => (
                  <Card
                    key={task.id}
                    className="group relative p-5 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                    
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-foreground text-lg leading-tight flex-1">
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-1 bg-gradient-to-br from-warning/20 to-warning/10 px-2.5 py-1 rounded-lg border border-warning/30 flex-shrink-0">
                          <Coins className="w-4 h-4 text-warning" />
                          <span className="text-sm font-bold">
                            <BonusBalanceDisplay amount={task.reward_amount} iconSize={16} />
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{task.time_limit_hours}год</span>
                        {task.max_completions && (
                          <>
                            <span>•</span>
                            <span>Макс: {task.max_completions}</span>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {task.requires_screenshot && (
                          <Badge variant="outline" className="text-xs">
                            📷 Скріншот
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {task.task_type === "telegram_subscription" ? "📢 Підписка" : "📝 Завдання"}
                        </Badge>
                      </div>

                      <Button 
                        className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTask(task);
                        }}
                      >
                        Почати виконання
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Наразі немає доступних завдань</p>
              </Card>
            )}
          </>
        )}

        {activeTab === "my-tasks" && (
          <MyTasksList />
        )}


        {activeTab === "my-submissions" && (
          <>
            {loadingSubmissions ? (
              <Loading />
            ) : mySubmissions && mySubmissions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mySubmissions.map((submission, index) => (
                  <Card
                    key={submission.id}
                    className="group relative p-5 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm border-border/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-foreground leading-tight flex-1">
                          {submission.tasks?.title}
                        </h3>
                        <Badge
                          variant={
                            submission.status === "completed" ? "default" :
                            submission.status === "in_progress" ? "secondary" :
                            submission.status === "submitted" ? "outline" :
                            "destructive"
                          }
                          className={
                            submission.status === "completed" ? "bg-success text-success-foreground" :
                            submission.status === "in_progress" ? "bg-warning/20 text-warning" :
                            ""
                          }
                        >
                          {submission.status === "completed" ? "✓ Виконано" :
                           submission.status === "in_progress" ? "⏳ В роботі" :
                           submission.status === "submitted" ? "👁️ На перевірці" :
                           "✗ Відхилено"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1 bg-gradient-to-br from-warning/20 to-warning/10 px-2.5 py-1 rounded-lg border border-warning/30">
                          <Coins className="w-3.5 h-3.5 text-warning" />
                          <span className="font-bold">
                            <BonusBalanceDisplay amount={submission.tasks?.reward_amount || 0} iconSize={16} />
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(submission.created_at).toLocaleDateString("uk-UA")}
                        </span>
                      </div>

                      {submission.review_comment && (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-xs font-semibold text-foreground mb-1">Коментар:</p>
                          <p className="text-xs text-muted-foreground">{submission.review_comment}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {submissionFilter === "all" 
                    ? "У вас ще немає виконаних завдань" 
                    : `Немає завдань зі статусом "${
                        submissionFilter === "in_progress" ? "В роботі" :
                        submissionFilter === "completed" ? "Виконані" :
                        "Відхилені"
                      }"`}
                </p>
              </Card>
            )}
          </>
        )}
      </div>

      {submissionToSubmit && (
        <SubmitTaskDialog
          submission={submissionToSubmit}
          open={submitDialogOpen}
          onOpenChange={(open) => {
            setSubmitDialogOpen(open);
            if (!open) setSubmissionToSubmit(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити завдання?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія незворотна. Завдання буде видалено назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteTaskMutation.mutate(taskToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskMarketplace;
