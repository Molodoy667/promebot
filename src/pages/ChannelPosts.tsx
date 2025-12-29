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
  MessageSquare, 
  Calendar,
  Eye,
  Image as ImageIcon,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Post {
  id: string;
  content: string;
  views: number;
  created_at: string;
  status: string;
  image_url?: string;
  message_id?: number;
}

export default function ChannelPosts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const postsPerPage = 20;

  const { serviceId, serviceType, channelName } = location.state || {};

  useEffect(() => {
    if (!serviceId || !serviceType) {
      toast({
        title: "Помилка",
        description: "Не вказано канал",
        variant: "destructive",
      });
      navigate("/my-channels");
      return;
    }

    loadPosts();
  }, [serviceId, serviceType, page]);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      
      const from = (page - 1) * postsPerPage;
      const to = from + postsPerPage - 1;

      if (serviceType === 'plagiarist') {
        const { data, error } = await supabase
          .from("posts_history")
          .select("id, post_content, views, created_at, status, image_url, message_id")
          .eq("bot_service_id", serviceId)
          .in("status", ["published", "success"])
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        
        const mapped = (data || []).map((d: any) => ({
          id: d.id,
          content: d.post_content || "",
          views: d.views ?? 0,
          created_at: d.created_at,
          status: d.status,
          image_url: d.image_url ?? undefined,
          message_id: d.message_id ?? undefined,
        }));
        
        if (page === 1) {
          setPosts(mapped);
        } else {
          setPosts(prev => [...prev, ...mapped]);
        }
        
        setHasMore(data?.length === postsPerPage);
      } else if (serviceType === 'ai') {
        const { data, error } = await supabase
          .from("ai_generated_posts")
          .select("id, content, views, created_at, status, image_url")
          .eq("ai_bot_service_id", serviceId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        
        if (page === 1) {
          setPosts(data || []);
        } else {
          setPosts(prev => [...prev, ...(data || [])]);
        }
        
        setHasMore(data?.length === postsPerPage);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити пости",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  if (isLoading && page === 1) return <Loading />;

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
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Опубліковані пости</h1>
              <p className="text-muted-foreground">{channelName}</p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <Card className="glass-effect">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{posts.length}</div>
                    <p className="text-xs text-muted-foreground">Завантажено</p>
                  </CardContent>
                </Card>
                <Card className="glass-effect">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">
                      {posts.reduce((sum, p) => sum + (p.views || 0), 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">Всього переглядів</p>
                  </CardContent>
                </Card>
                <Card className="glass-effect">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">
                      {posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.views || 0), 0) / posts.length) : 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Середньо на пост</p>
                  </CardContent>
                </Card>
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="glass-effect hover:bg-accent/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {post.image_url && (
                    <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
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
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                        {post.content}
                      </p>
                      {post.image_url && !post.content && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ImageIcon className="w-4 h-4" />
                          <span className="text-sm">Медіа контент</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        <span className="font-semibold">{post.views?.toLocaleString() || 0}</span>
                        <span>переглядів</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(post.created_at).toLocaleString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        Опубліковано
                      </Badge>
                      
                      {post.message_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          onClick={() => {
                            const link = channelName.startsWith('@') 
                              ? `https://t.me/${channelName.substring(1)}/${post.message_id}`
                              : `https://t.me/c/${channelName.replace('-100', '')}/${post.message_id}`;
                            window.open(link, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Відкрити в Telegram
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && !isLoading && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoading}
            >
              {isLoading ? "Завантаження..." : "Завантажити ще"}
            </Button>
          </div>
        )}

        {isLoading && page > 1 && (
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">Завантаження...</p>
          </div>
        )}

        {posts.length === 0 && !isLoading && (
          <Card className="glass-effect">
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Немає опублікованих постів</h3>
              <p className="text-muted-foreground">
                Пости з'являться тут після публікації в каналі
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
