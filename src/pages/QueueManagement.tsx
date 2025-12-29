import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { 
  ArrowLeft, 
  Clock,
  Calendar,
  Trash2,
  Edit,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Sparkles,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url?: string;
}

export default function QueueManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [publishInterval, setPublishInterval] = useState(60);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  const { serviceId, serviceType, channelName } = location.state || {};

  useEffect(() => {
    if (!serviceId || serviceType !== 'ai') {
      toast({
        title: "Помилка",
        description: "Черга доступна тільки для AI ботів",
        variant: "destructive",
      });
      navigate("/my-channels");
      return;
    }

    loadQueue();

    // Real-time subscription
    const subscription = supabase
      .channel(`queue_${serviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_generated_posts',
          filter: `ai_bot_service_id=eq.${serviceId}`
        },
        () => {
          console.log('Queue changed, reloading...');
          loadQueue();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [serviceId]);

  const loadQueue = async () => {
    try {
      setIsLoading(true);

      const { data: scheduled } = await supabase
        .from("ai_generated_posts")
        .select("id, content, created_at, image_url")
        .eq("ai_bot_service_id", serviceId)
        .eq("status", "scheduled")
        .order("created_at", { ascending: true });
      
      setScheduledPosts(scheduled || []);

      // Load settings
      const { data: settings } = await supabase
        .from("ai_publishing_settings")
        .select("post_interval_minutes")
        .eq("ai_bot_service_id", serviceId)
        .single();

      const { data: service } = await supabase
        .from("ai_bot_services")
        .select("last_published_at")
        .eq("id", serviceId)
        .single();

      setPublishInterval(settings?.post_interval_minutes || 60);
      setLastPublishedAt(service?.last_published_at || null);
    } catch (error) {
      console.error("Error loading queue:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити чергу",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;

    try {
      const { error } = await supabase
        .from("ai_generated_posts")
        .delete()
        .eq("id", postToDelete.id);

      if (error) throw error;

      toast({
        title: "Пост видалено",
        description: "Генерується новий пост на заміну...",
      });

      setDeleteDialogOpen(false);
      setPostToDelete(null);

      // Generate new post with status tracking
      setIsGenerating(true);
      setGenerationStatus("Генерація нового поста...");
      
      await supabase.functions.invoke("generate-ai-posts", {
        body: { serviceId, count: 1 },
      });

      setGenerationStatus(null);
      setIsGenerating(false);
      loadQueue();
    } catch (error: any) {
      console.error("Error deleting post:", error);
      setIsGenerating(false);
      setGenerationStatus(null);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити пост",
        variant: "destructive",
      });
    }
  };

  const handleManualGenerate = async () => {
    if (scheduledPosts.length >= 10) {
      toast({
        title: "Черга заповнена",
        description: "Максимум 10 постів в черзі",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      const postsToGenerate = Math.min(10 - scheduledPosts.length, 3);
      setGenerationStatus(`Генерація ${postsToGenerate} ${postsToGenerate === 1 ? 'поста' : 'постів'}...`);

      await supabase.functions.invoke("generate-ai-posts", {
        body: { serviceId, count: postsToGenerate },
      });

      toast({
        title: "Успішно",
        description: `Згенеровано ${postsToGenerate} ${postsToGenerate === 1 ? 'пост' : 'постів'}`,
      });

      setGenerationStatus(null);
      setIsGenerating(false);
      loadQueue();
    } catch (error: any) {
      console.error("Error generating posts:", error);
      setIsGenerating(false);
      setGenerationStatus(null);
      toast({
        title: "Помилка",
        description: "Не вдалося згенерувати пости",
        variant: "destructive",
      });
    }
  };

  const handleEditPost = async () => {
    if (!postToEdit || !editedContent.trim()) return;

    try {
      const { error } = await supabase
        .from("ai_generated_posts")
        .update({ content: editedContent.trim() })
        .eq("id", postToEdit.id);

      if (error) throw error;

      toast({
        title: "Пост оновлено",
        description: "Зміни збережено успішно",
      });

      setEditDialogOpen(false);
      setPostToEdit(null);
      setEditedContent("");

      loadQueue();
    } catch (error: any) {
      console.error("Error editing post:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити пост",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/channel-stats", { 
              state: { serviceId, serviceType, channelName } 
            })}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад до статистики
          </Button>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Черга публікації</h1>
                <p className="text-muted-foreground">{channelName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualGenerate}
                disabled={isGenerating || scheduledPosts.length >= 10}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Згенерувати
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadQueue}
                disabled={isGenerating}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Оновити
              </Button>
            </div>
          </div>

          {/* Generation Status Banner */}
          {isGenerating && generationStatus && (
            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3 animate-pulse">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div>
                <p className="font-medium text-primary">AI генерує контент</p>
                <p className="text-sm text-muted-foreground">{generationStatus}</p>
              </div>
            </div>
          )}
        </div>

        {scheduledPosts.length > 0 ? (
          <Card className="glass-effect border-2 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Черга постів</span>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                  {scheduledPosts.length}/10 в черзі
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledPosts.map((post, index) => (
                  <Card key={post.id} className={`bg-accent/30 ${index === 0 ? 'border-2 border-primary/50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {post.image_url && (
                          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                            <img 
                              src={post.image_url} 
                              alt="Post media" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Badge variant="outline" className="flex-shrink-0">
                              #{index + 1}
                            </Badge>
                            {index === 0 && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                Наступний
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3 mb-3">
                            {post.content}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                              {(() => {
                                const now = Date.now();
                                const createdAt = new Date(post.created_at).getTime();
                                
                                if (index === 0) {
                                  if (!lastPublishedAt) {
                                    const minutesSinceCreation = Math.floor((now - createdAt) / 60000);
                                    const minutesLeft = Math.max(0, 5 - minutesSinceCreation);
                                    return minutesLeft === 0 ? "Публікується..." : `Через ${minutesLeft} хв`;
                                  } else {
                                    const lastPublish = new Date(lastPublishedAt).getTime();
                                    const minutesSincePublish = Math.floor((now - lastPublish) / 60000);
                                    const minutesLeft = Math.max(0, publishInterval - minutesSincePublish);
                                    return minutesLeft === 0 ? "Публікується..." : `Через ${minutesLeft} хв`;
                                  }
                                } else {
                                  const totalMinutes = lastPublishedAt 
                                    ? publishInterval * index
                                    : 5 + publishInterval * (index - 1);
                                  return `Через ~${totalMinutes} хв`;
                                }
                              })()}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {new Date(post.created_at).toLocaleString("uk-UA", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPostToEdit(post);
                                setEditedContent(post.content);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Редагувати
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPostToDelete(post);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Видалити
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-effect">
            <CardContent className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Черга порожня</h3>
              <p className="text-muted-foreground">
                Пости генеруються автоматично коли бот запущений
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Видалити пост?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Цей пост буде видалено з черги публікації. На його місце буде згенеровано новий пост автоматично.
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-sm text-foreground line-clamp-3">
                  {postToDelete?.content}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePost}
              className="bg-destructive hover:bg-destructive/90"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редагувати пост</DialogTitle>
            <DialogDescription>
              Внесіть зміни до тексту поста. Пост залишиться в черзі на тій же позиції.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={10}
              className="resize-none"
              placeholder="Введіть текст поста..."
            />
            <div className="text-sm text-muted-foreground">
              Символів: {editedContent.length}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setPostToEdit(null);
                setEditedContent("");
              }}
            >
              Скасувати
            </Button>
            <Button
              onClick={handleEditPost}
              disabled={!editedContent.trim()}
            >
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
