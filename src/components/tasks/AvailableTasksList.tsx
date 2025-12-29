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

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task: any) => (
          <Card key={task.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant={task.task_type === "vip" ? "default" : "secondary"}>
                  {task.task_type === "vip" ? "VIP" : "Бонусне"}
                </Badge>
                <span className="text-lg font-bold text-primary">
                  {task.reward_amount.toFixed(2)} ₴
                </span>
              </div>
              <CardTitle className="line-clamp-2">{task.title}</CardTitle>
              <CardDescription className="line-clamp-2">
                {task.description}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{task.time_limit_hours} год на виконання</span>
                </div>
                {task.available_executions > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Залишилось місць: <strong>{task.available_executions}</strong></span>
                  </div>
                )}
                {task.max_completions && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>1 користувач → 1 виконання</span>
                  </div>
                )}
                {task.requires_screenshot && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Camera className="h-4 w-4" />
                    <span>Потрібен скріншот</span>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => setSelectedTask(task)}
              >
                Переглянути деталі
              </Button>
            </CardFooter>
          </Card>
        ))}
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