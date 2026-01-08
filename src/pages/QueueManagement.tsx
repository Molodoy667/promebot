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
  Globe,
  Lock,
  Users,
  Bot
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
  const [channelInfo, setChannelInfo] = useState<any>(null);
  const [timeFrom, setTimeFrom] = useState<string | null>(null);
  const [timeTo, setTimeTo] = useState<string | null>(null);

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

    loadChannelInfo();
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

  const loadChannelInfo = async () => {
    try {
      const { data } = await supabase
        .from('ai_bot_services')
        .select('target_channel, spy_id, bot_id')
        .eq('id', serviceId)
        .single();

      // Спочатку пробуємо з spy
      if (data?.spy_id) {
        const { data: spy } = await supabase
          .from('telegram_spies')
          .select('channel_info')
          .eq('id', data.spy_id)
          .single();

        if (spy?.channel_info) {
          setChannelInfo(spy.channel_info);
          return;
        }
      }

      // Fallback: завантажуємо через Bot API
      if (data?.bot_id && data?.target_channel) {
        const { data: bot } = await supabase
          .from('telegram_bots')
          .select('bot_token')
          .eq('id', data.bot_id)
          .single();

        if (bot?.bot_token) {
          const response = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getChat?chat_id=${data.target_channel}`);
          const apiData = await response.json();

          if (apiData.ok) {
            const chat = apiData.result;
            let membersCount = chat.members_count;
            
            if (!membersCount && (chat.type === 'channel' || chat.type === 'supergroup')) {
              const membersResponse = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getChatMemberCount?chat_id=${data.target_channel}`);
              const membersData = await membersResponse.json();
              if (membersData.ok) membersCount = membersData.result;
            }

            // Отримуємо фото каналу
            let photoUrl = undefined;
            if (chat.photo?.big_file_id) {
              try {
                const fileResponse = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getFile?file_id=${chat.photo.big_file_id}`);
                const fileData = await fileResponse.json();
                if (fileData.ok) {
                  photoUrl = `https://api.telegram.org/file/bot${bot.bot_token}/${fileData.result.file_path}`;
                }
              } catch (err) {
                console.error("Error getting photo:", err);
              }
            }

            setChannelInfo({
              title: chat.title || data.target_channel,
              username: chat.username || data.target_channel,
              isPrivate: !chat.username,
              membersCount,
              photo: photoUrl,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading channel info:', error);
    }
  };

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
        .select("post_interval_minutes, time_from, time_to")
        .eq("ai_bot_service_id", serviceId)
        .single();

      const { data: service } = await supabase
        .from("ai_bot_services")
        .select("last_published_at")
        .eq("id", serviceId)
        .single();

      setPublishInterval(settings?.post_interval_minutes || 60);
      setLastPublishedAt(service?.last_published_at || null);
      setTimeFrom(settings?.time_from || null);
      setTimeTo(settings?.time_to || null);
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
          
          <Card className="glass-effect">
            <CardContent className="p-6">
              {/* Back Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/channel-posts", { 
                  state: { serviceId, serviceType, channelName } 
                })}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад до публікацій
              </Button>
              
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {channelInfo?.photo ? (
                    <img 
                      src={channelInfo.photo} 
                      alt={channelInfo.title}
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-10 h-10 text-primary" />
                    </div>
                  )}
                </div>
                
                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold mb-1 truncate">
                    {channelInfo?.title || channelName}
                  </h1>
                  
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-muted-foreground">
                      @{channelInfo?.username || channelName}
                    </span>
                    <Badge variant={channelInfo?.isPrivate ? "secondary" : "default"}>
                      {channelInfo?.isPrivate ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Приватний
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 mr-1" />
                          Публічний
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Бот
                    </Badge>
                    {channelInfo?.membersCount && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                        <Users className="w-3 h-3 mr-1" />
                        {channelInfo.membersCount.toLocaleString()} підписників
                      </Badge>
                    )}
                  </div>
                  
                  <h2 className="text-lg font-semibold mb-2">Черга публікацій</h2>
                  <p className="text-sm text-muted-foreground">
                    Автогенерація кожні 10 хвилин • {scheduledPosts.length} постів в черзі
                    {timeFrom && timeTo && (
                      <span className="ml-2">
                        • ⏰ Публікація: {timeFrom.substring(0, 5)} - {timeTo.substring(0, 5)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span>Черга постів</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                    {scheduledPosts.length}/10 в черзі
                  </Badge>
                </CardTitle>
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
                              <Clock className="w-3 h-3 mr-1" />
                              {(() => {
                                const now = Date.now();
                                const createdAt = new Date(post.created_at).getTime();
                                
                                // Перший пост
                                let publishTime;
                                if (index === 0) {
                                  if (!lastPublishedAt) {
                                    publishTime = createdAt + (5 * 60000); // Через 5 хв після створення
                                  } else {
                                    publishTime = new Date(lastPublishedAt).getTime() + (publishInterval * 60000);
                                  }
                                } else {
                                  // Інші пости - рахуємо від ПЕРШОГО поста
                                  const firstPostTime = !lastPublishedAt 
                                    ? new Date(scheduledPosts[0].created_at).getTime() + (5 * 60000)
                                    : new Date(lastPublishedAt).getTime() + (publishInterval * 60000);
                                  
                                  publishTime = firstPostTime + (publishInterval * index * 60000);
                                }
                                
                                // Якщо встановлено фільтр часу - перевіряємо чи час публікації в дозволеному діапазоні
                                if (timeFrom && timeTo) {
                                  const publishDate = new Date(publishTime);
                                  const publishHour = publishDate.getHours();
                                  const publishMinute = publishDate.getMinutes();
                                  const publishTimeStr = `${publishHour.toString().padStart(2, '0')}:${publishMinute.toString().padStart(2, '0')}`;
                                  
                                  // Якщо час публікації поза дозволеним діапазоном
                                  if (publishTimeStr < timeFrom || publishTimeStr >= timeTo) {
                                    return `⏰ Чекає ${timeFrom.substring(0, 5)}`;
                                  }
                                }
                                
                                // Якщо час публікації вже настав
                                if (publishTime <= now) {
                                  return "Публікується...";
                                }
                                
                                // Показуємо точний час публікації
                                const publishDate = new Date(publishTime);
                                return publishDate.toLocaleTimeString('uk-UA', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
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
