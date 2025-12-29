import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Clock, DollarSign, Users, Camera, AlertCircle, RefreshCw, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const TaskModerationDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase.rpc('has_role', {
      _user_id: session.user.id,
      _role: 'admin'
    });

    if (error || !data) {
      toast({ title: "Помилка", description: "У вас немає прав адміністратора", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    setIsLoadingAccess(false);
  };

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-moderation", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (error) throw error;
      
      // Fetch profile separately
      if (data?.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, user_number, created_at")
          .eq("id", data.user_id)
          .single();
        
        if (!profileError && profileData) {
          return { ...data, profiles: profileData };
        }
      }
      
      return data;
    },
    enabled: !isLoadingAccess,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({
      status,
      comment,
    }: {
      status: "approved" | "rejected" | "needs_revision";
      comment: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизовано");

      if ((status === "rejected" || status === "needs_revision") && !comment.trim()) {
        throw new Error(
          status === "rejected" 
            ? "Вкажіть причину відхилення"
            : "Вкажіть що потрібно виправити"
        );
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          status: status,
          moderated_by: user.id,
          moderated_at: new Date().toISOString(),
          moderation_comment: comment || null,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const action = 
        variables.status === "approved" ? "схвалено" :
        variables.status === "needs_revision" ? "відправлено на переробку" :
        "відхилено";
      toast({ title: "Успішно", description: `Завдання ${action}` });
      queryClient.invalidateQueries({ queryKey: ["pending-tasks"] });
      navigate("/admin/tasks");
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message || "Помилка при модерації", variant: "destructive" });
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const handleModerate = async (status: "approved" | "rejected" | "needs_revision") => {
    if ((status === "rejected" || status === "needs_revision") && !comment.trim()) {
      toast({ title: "Помилка", description: 
        status === "rejected" 
          ? "Вкажіть причину відхилення у коментарі"
          : "Вкажіть що потрібно виправити у коментарі"
      , variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    await moderateMutation.mutateAsync({ status, comment });
  };

  if (isLoadingAccess || isLoading) {
    return <Loading message="Завантаження завдання..." />;
  }

  if (!task) {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-6">
          <Card className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Завдання не знайдено</p>
            <Button className="mt-4" onClick={() => navigate("/admin/tasks")}>
              Повернутись до списку
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const author = (task as any)?.profiles;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/admin/tasks")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад до списку
        </Button>

        {/* Author Info Card */}
        <Card className="mb-6 glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Автор завдання
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={author?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {author?.full_name?.[0] || author?.email?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">{author?.full_name || "Без імені"}</p>
                <p className="text-sm text-muted-foreground">{author?.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">ID: #{author?.user_number}</Badge>
                  <Badge variant="outline">
                    Реєстрація: {format(new Date(author?.created_at), "MMM yyyy", { locale: uk })}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Details Card */}
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
                <p className="text-muted-foreground">
                  Створено: {format(new Date(task.created_at), "d MMMM yyyy, HH:mm", { locale: uk })}
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge variant={task.task_type === "telegram_subscription" ? "default" : "secondary"} className="text-base">
                  {task.task_type === "telegram_subscription" ? "📢 Підписка" : "📝 Завдання"}
                </Badge>
                <div className="flex items-center gap-1 bg-gradient-to-br from-warning/20 to-warning/10 px-4 py-2 rounded-lg border border-warning/30">
                  <DollarSign className="w-5 h-5 text-warning" />
                  <span className="text-xl font-bold text-warning">{task.reward_amount.toFixed(2)}₴</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Опис завдання:
              </h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                <Clock className="h-5 w-5 text-primary" />
                <span>Час на виконання: <strong>{task.time_limit_hours} год</strong></span>
              </div>

              {task.max_completions && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                  <Users className="h-5 w-5 text-primary" />
                  <span>Обмеження: <strong>Кожен користувач може виконати 1 раз</strong></span>
                </div>
              )}

              {task.requires_screenshot && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <Camera className="h-5 w-5 text-warning" />
                  <span className="text-warning font-medium">
                    Обов'язковий скріншот підтвердження
                  </span>
                </div>
              )}

              {task.telegram_channel_link && (
                <div className="p-3 rounded-lg bg-background/50">
                  <span className="text-xs text-muted-foreground">Telegram канал:</span>
                  <p className="font-mono text-sm break-all mt-1">{task.telegram_channel_link}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Коментар модератора
                <span className="text-xs text-muted-foreground font-normal">
                  (обов'язковий для відхилення/переробки)
                </span>
              </label>
              <Textarea
                placeholder="Вкажіть причину відхилення або що потрібно виправити..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="bg-background/80 border-border/50"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="default"
                onClick={() => handleModerate("approved")}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-success to-success/80 hover:opacity-90 h-12"
              >
                <Check className="h-5 w-5 mr-2" />
                Схвалити
              </Button>
              <Button
                variant="outline"
                onClick={() => handleModerate("needs_revision")}
                disabled={isProcessing}
                className="flex-1 border-warning/50 text-warning hover:bg-warning/10 h-12"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                На переробку
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleModerate("rejected")}
                disabled={isProcessing}
                className="flex-1 h-12"
              >
                <X className="h-5 w-5 mr-2" />
                Відхилити
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskModerationDetail;


