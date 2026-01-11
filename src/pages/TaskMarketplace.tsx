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
import { AvailableTasksList } from "@/components/tasks/AvailableTasksList";
import { MySubmissionsList } from "@/components/tasks/MySubmissionsList";
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

        {activeTab === "my-submissions" && (
          <div className="mb-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-semibold">Всього</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{submissionStats.all}</p>
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

              <div className="group/stat p-4 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-all duration-300 hover:scale-105">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-semibold">Відхилено</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{submissionStats.rejected}</p>
              </div>
            </div>
          </div>
        )}

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


        {/* Content */}
        {activeTab === "available" && (
          <AvailableTasksList />
        )}

        {activeTab === "my-tasks" && (
          <MyTasksList />
        )}


        {activeTab === "my-submissions" && (
          <MySubmissionsList />
        )}
      </div>

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
