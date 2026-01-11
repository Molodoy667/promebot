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
import { Wallet, Clock, Camera, Users, MessageCircle, Eye, ThumbsUp, Share2, FileText, TestTube, Briefcase, ClipboardList, Crown, Gift, Link as LinkIcon } from "lucide-react";
import { SubmissionsReviewList } from "./SubmissionsReviewList";
import { TaskBudgetDialog } from "./TaskBudgetDialog";
import { useState } from "react";

const categoryConfig: Record<string, { label: string; icon: any }> = {
  telegram_subscription: { label: 'Підписка на Telegram канал', icon: MessageCircle },
  telegram_view: { label: 'Перегляд посту в Telegram', icon: Eye },
  telegram_reaction: { label: 'Реакція на пост в Telegram', icon: ThumbsUp },
  social_media: { label: 'Соціальні мережі', icon: Share2 },
  content_creation: { label: 'Створення контенту', icon: FileText },
  testing: { label: 'Тестування', icon: TestTube },
  general: { label: 'Загальне', icon: Briefcase }
};

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
  
  const categoryInfo = categoryConfig[task.category] || { label: task.category, icon: Briefcase };
  const CategoryIcon = categoryInfo.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <div className="flex items-center gap-2">
                <Badge variant={task.balance_type === "main" ? "default" : "secondary"} className="flex items-center gap-1">
                  {task.balance_type === "main" ? (
                    <>
                      <Crown className="w-3 h-3" />
                      Основний баланс
                    </>
                  ) : (
                    <>
                      <Gift className="w-3 h-3" />
                      Бонусний баланс
                    </>
                  )}
                </Badge>
                {task.status === "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBudgetDialogOpen(true)}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Бюджет
                  </Button>
                )}
              </div>
              <span className="text-2xl font-bold text-primary">
                {task.reward_amount.toFixed(2)} ₴
              </span>
            </div>
            
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
            
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
            {/* Task images */}
            {task.images && task.images.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Зображення:</h4>
                <div className="flex gap-2 flex-wrap">
                  {task.images.map((img: string, idx: number) => (
                    <a 
                      key={idx}
                      href={img} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={img} 
                        alt={`Task image ${idx + 1}`}
                        className="w-32 h-32 object-cover rounded border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">Опис:</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>

            <div className="grid gap-3 text-sm">
              {/* Category */}
              {task.category && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                  <span className="text-muted-foreground min-w-[140px]">Категорія:</span>
                  <Badge variant="outline" className="flex items-center gap-1.5">
                    <CategoryIcon className="w-3.5 h-3.5" />
                    {categoryInfo.label}
                  </Badge>
                </div>
              )}

              {/* Time limit */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground min-w-[140px]">Час на виконання:</span>
                <span className="font-medium">{task.time_limit_hours} год</span>
              </div>

              {/* Screenshot requirement */}
              <div className={`flex items-center gap-2 p-3 rounded-lg ${task.requires_screenshot ? 'bg-warning/10 border border-warning/30' : 'bg-background/50'}`}>
                <Camera className={`w-4 h-4 ${task.requires_screenshot ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className={task.requires_screenshot ? 'text-warning font-medium' : 'text-muted-foreground'}>
                  {task.requires_screenshot ? "Обов'язковий скріншот підтвердження" : "Скріншот не потрібен"}
                </span>
              </div>

              {/* Max completions */}
              {task.max_completions && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground min-w-[140px]">Обмеження:</span>
                  <span className="font-medium">1 виконання на користувача</span>
                </div>
              )}

              {/* Telegram channel */}
              {task.telegram_channel_link && (
                <div className="p-3 rounded-lg bg-background/50">
                  <span className="text-xs text-muted-foreground">Telegram канал:</span>
                  <div className="flex items-center gap-2 mt-1">
                    {task.channel_info?.photo && (
                      <img 
                        src={task.channel_info.photo} 
                        alt={task.channel_info.title}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <a 
                      href={task.telegram_channel_link.startsWith('http') ? task.telegram_channel_link : `https://t.me/${task.telegram_channel_link.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm font-mono"
                    >
                      {task.channel_info?.title || task.telegram_channel_link}
                    </a>
                    {task.channel_info?.membersCount && (
                      <Badge variant="secondary" className="text-xs">
                        {task.channel_info.membersCount.toLocaleString()} підписників
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Additional links */}
              {task.additional_links && Array.isArray(task.additional_links) && task.additional_links.length > 0 && (
                <div className="p-3 rounded-lg bg-background/50 space-y-2">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Додаткові посилання:
                  </span>
                  <div className="space-y-1">
                    {task.additional_links.map((link: string, idx: number) => (
                      <a 
                        key={idx}
                        href={link.startsWith('http') ? link : link.startsWith('@') || link.includes('t.me/') ? `https://t.me/${link.replace('@', '')}` : link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-primary hover:underline text-sm font-mono break-all"
                      >
                        {idx + 1}. {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}
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