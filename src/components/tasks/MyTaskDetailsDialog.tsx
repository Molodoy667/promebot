import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { SubmissionsReviewList } from "./SubmissionsReviewList";
import { TaskBudgetDialog } from "./TaskBudgetDialog";
import { useState } from "react";

interface MyTaskDetailsDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MyTaskDetailsDialog = ({ task, open, onOpenChange }: MyTaskDetailsDialogProps) => {
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  const { data: submissions } = useQuery({
    queryKey: ["task-submissions", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_submissions")
        .select(`
          *,
          profiles!task_submissions_user_id_fkey(full_name, email)
        `)
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("balance, bonus_balance")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const approvedSubmissions = submissions?.filter(s => s.status === "approved").length || 0;
  const pendingReview = submissions?.filter(s => s.status === "submitted").length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={task.task_type === "vip" ? "default" : "secondary"}>
                  {task.task_type === "vip" ? "VIP" : "Бонусне"}
                </Badge>
                <span className="text-lg font-bold text-primary">
                  {task.reward_amount.toFixed(2)} ₴
                </span>
              </div>
              
              {task.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBudgetDialogOpen(true)}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Управління бюджетом
                </Button>
              )}
            </div>
            <DialogTitle>{task.title}</DialogTitle>
            
            {/* Budget Info - Show only for approved tasks */}
            {task.status === "approved" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Бюджет</p>
                  <p className="text-sm font-semibold">{task.budget?.toFixed(2) || "0.00"} ₴</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Доступно виконань</p>
                  <p className="text-sm font-semibold">{task.available_executions || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Виконано</p>
                  <p className="text-sm font-semibold">{approvedSubmissions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">На перевірці</p>
                  <p className="text-sm font-semibold">{pendingReview}</p>
                </div>
              </div>
            )}
          </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Інформація</TabsTrigger>
            <TabsTrigger value="submissions">
              Виконання ({submissions?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Опис:</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>

            <div className="grid gap-2 text-sm">
              <p>Час на виконання: <strong>{task.time_limit_hours} год</strong></p>
              <p>
                Обмеження: <strong>
                  {task.max_completions ? "1 користувач → 1 виконання" : "Безлімітно"}
                </strong>
              </p>
              <p>
                Скріншот: <strong>{task.requires_screenshot ? "Обов'язковий" : "Не потрібен"}</strong>
              </p>
            </div>

            {task.moderation_comment && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-1">Коментар модератора:</h4>
                <p className="text-sm">{task.moderation_comment}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions">
            <SubmissionsReviewList 
              submissions={submissions || []} 
              taskId={task.id}
              task={task}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {userProfile && (
      <TaskBudgetDialog
        task={task}
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        userBalance={userProfile.balance || 0}
        userBonusBalance={userProfile.bonus_balance || 0}
      />
    )}
    </>
  );
};