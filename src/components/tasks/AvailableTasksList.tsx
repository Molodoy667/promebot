import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Users, Camera } from "lucide-react";
import { useState } from "react";
import { TaskDetailsDialog } from "./TaskDetailsDialog";

export const AvailableTasksList = () => {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [balanceFilter, setBalanceFilter] = useState<"all" | "bonus" | "main">("all");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["available-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_submissions!task_submissions_task_id_fkey (
            id,
            user_id,
            status
          )
        `)
        .eq("status", "active")
        .neq("user_id", user.id);

      if (error) throw error;

      // Filter out tasks user already started/completed
      return data?.filter((task: any) => {
        const userSubmission = task.task_submissions?.find(
          (sub: any) => sub.user_id === user.id
        );
        return !userSubmission;
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Наразі немає доступних завдань</p>
      </div>
    );
  }

  const filteredTasks = tasks.filter((task: any) => {
    if (balanceFilter === "all") return true;
    return task.balance_type === balanceFilter;
  });

  const getTaskCounters = (task: any) => {
    const submissions = task.task_submissions || [];
    return {
      approved: submissions.filter((s: any) => s.status === 'approved').length,
      inProgress: submissions.filter((s: any) => s.status === 'in_progress').length,
      rejected: submissions.filter((s: any) => s.status === 'rejected').length,
    };
  };

  return (
    <>
      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={balanceFilter === "all" ? "default" : "outline"}
          onClick={() => setBalanceFilter("all")}
        >
          Всі
        </Button>
        <Button
          size="sm"
          variant={balanceFilter === "bonus" ? "default" : "outline"}
          onClick={() => setBalanceFilter("bonus")}
        >
          Бонусні
        </Button>
        <Button
          size="sm"
          variant={balanceFilter === "main" ? "default" : "outline"}
          onClick={() => setBalanceFilter("main")}
        >
          Основні
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTasks.map((task: any) => {
          const counters = getTaskCounters(task);
          return (
          <Card 
            key={task.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedTask(task)}
          >
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant={task.balance_type === "main" ? "default" : "secondary"}>
                  <svg className="w-3 h-3 mr-1 inline-block" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                  </svg>
                  {task.balance_type === "main" ? "Основний" : "Бонус"}
                </Badge>
                <span className="text-lg font-bold text-primary">
                  {task.reward_amount.toFixed(2)} ₴
                </span>
              </div>
              <CardTitle className="line-clamp-1 text-base">{task.title}</CardTitle>
              <CardDescription className="line-clamp-2 text-xs">
                {task.description}
              </CardDescription>
              
              {/* Counters */}
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  ✓ {counters.approved}
                </Badge>
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                  ⏳ {counters.inProgress}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                  ✗ {counters.rejected}
                </Badge>
              </div>
            </CardHeader>
          </Card>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </>
  );
};