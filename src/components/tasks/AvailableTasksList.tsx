import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Users, Camera, ClipboardList, Crown } from "lucide-react";
import { useState } from "react";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const AvailableTasksList = () => {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [balanceFilter, setBalanceFilter] = useState<"all" | "bonus" | "main">("all");
  const [sortBy, setSortBy] = useState<"date" | "price">("date");

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
          ),
          profiles!tasks_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq("status", "active");

      if (error) throw error;

      // Mark tasks and filter
      return data?.map((task: any) => {
        const isOwner = task.user_id === user.id;
        const userSubmission = task.task_submissions?.find(
          (sub: any) => sub.user_id === user.id
        );
        
        return {
          ...task,
          isOwner,
          canTake: !isOwner && !userSubmission
        };
      }).filter((task: any) => {
        // Show all tasks including owner's, but filter out already taken
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

  const filteredTasks = tasks
    .filter((task: any) => {
      if (balanceFilter === "all") return true;
      return task.balance_type === balanceFilter;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "price") {
        return b.reward_amount - a.reward_amount;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      {/* Filters and Sorting */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-sm font-medium mb-2">Тип балансу</h3>
            <Tabs value={balanceFilter} onValueChange={(v) => setBalanceFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Всі</TabsTrigger>
                <TabsTrigger value="bonus">Бонусні</TabsTrigger>
                <TabsTrigger value="main">Баланс</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Сортування</h3>
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <TabsList>
                <TabsTrigger value="date">По даті</TabsTrigger>
                <TabsTrigger value="price">По ціні</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTasks.map((task: any) => {
          const counters = getTaskCounters(task);
          const taskImage = task.images && task.images.length > 0 ? task.images[0] : null;
          
          return (
          <Card 
            key={task.id}
            className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
            onClick={() => setSelectedTask(task)}
          >
            {/* Task Image or Icon */}
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
              
              {/* Owner Badge */}
              {task.isOwner && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-yellow-500/90 text-white border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Власне
                  </Badge>
                </div>
              )}
              
              {/* Balance Type Badge */}
              <div className="absolute top-2 right-2">
                <Badge variant={task.balance_type === "main" ? "default" : "secondary"}>
                  {task.balance_type === "main" ? "Баланс" : "Бонусне"}
                </Badge>
              </div>
            </div>

            <CardHeader className="space-y-3">
              {/* Author Info */}
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={task.profiles?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {task.profiles?.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">
                  {task.profiles?.username || "Невідомий"}
                </span>
              </div>

              {/* Title */}
              <CardTitle className="line-clamp-2 text-base leading-tight">
                {task.title}
              </CardTitle>
              
              {/* Description */}
              <CardDescription className="line-clamp-3 text-xs leading-relaxed">
                {task.description}
              </CardDescription>

              {/* Stats Row */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">{task.reward_amount.toFixed(2)} ₴</span>
                </div>
                
                <div className="flex gap-1">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0">
                    ✓ {counters.approved}
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs px-1.5 py-0">
                    ⏳ {counters.inProgress}
                  </Badge>
                </div>
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
