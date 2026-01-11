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
            telegram_username,
            full_name,
            avatar_url
          )
        `)
        .eq("status", "active");

      if (error) {
        console.error("Tasks query error:", error);
        throw error;
      }

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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              {/* Author Info & Reward */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={task.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {(task.profiles?.telegram_username?.[0] || task.profiles?.full_name?.[0] || "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {task.profiles?.telegram_username || task.profiles?.full_name || "Невідомий"}
                  </span>
                </div>
                
                {/* Reward Badge */}
                <Badge variant={task.balance_type === "main" ? "default" : "secondary"} className="text-xs font-bold">
                  {task.reward_amount.toFixed(2)} ₴
                </Badge>
              </div>

              {/* Category */}
              {task.task_type && (
                <Badge variant="outline" className="w-fit text-xs">
                  {categoryLabels[task.task_type] || task.task_type}
                </Badge>
              )}

              {/* Title */}
              <CardTitle className="line-clamp-2 text-base leading-tight">
                {task.title}
              </CardTitle>
              
              {/* Description */}
              <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                {task.description}
              </CardDescription>

              {/* Budget */}
              <div className="text-sm font-semibold text-center py-2 bg-primary/5 rounded-lg">
                Бюджет: {(task.budget || 0).toFixed(2)} ₴
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-2">
                {/* Approved */}
                <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-green-500/10 border border-green-500/30">
                  <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-bold text-green-600 dark:text-green-500">{counters.approved}</span>
                </div>
                
                {/* In Progress */}
                <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30">
                  <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-500">{counters.inProgress}</span>
                </div>
                
                {/* Rejected */}
                <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-red-500/10 border border-red-500/30">
                  <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-bold text-red-600 dark:text-red-500">{counters.rejected}</span>
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
