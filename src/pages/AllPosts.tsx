import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { 
  MessageSquare, 
  Calendar,
  Eye,
  Heart,
  ExternalLink,
  ArrowLeft,
  TrendingUp,
  Globe,
  Lock,
  Users,
  Sparkles,
  Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Post {
  id: string;
  content: string;
  views: number;
  reactions: number;
  created_at: string;
  message_id?: number;
  scraping_stats?: any;
  mtproto_stats?: any;
  post_content?: string;
}

export default function AllPosts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { serviceId, serviceType, channelName } = location.state || {};
  
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [channelInfo, setChannelInfo] = useState<any>(null);
  const postsPerPage = 10;
  const maxPosts = 100;

  useEffect(() => {
    if (!serviceId || !serviceType) {
      navigate("/my-channels");
      return;
    }
    loadChannelInfo();
    loadPosts();
  }, [serviceId, serviceType, currentPage]);

  const loadChannelInfo = async () => {
    try {
      const table = serviceType === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      const { data } = await supabase
        .from(table)
        .select('target_channel, spy_id')
        .eq('id', serviceId)
        .single();

      if (data?.spy_id) {
        // Get from spy
        const { data: spy } = await supabase
          .from('telegram_spies')
          .select('channel_info')
          .eq('id', data.spy_id)
          .single();

        if (spy?.channel_info) {
          setChannelInfo(spy.channel_info);
        }
      }
    } catch (error) {
      console.error('Error loading channel info:', error);
    }
  };

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const table = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
      const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
      
      // Get total count
      const { count } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idField, serviceId)
        .eq('status', 'published');
      
      setTotalPosts(Math.min(count || 0, maxPosts));

      // Get posts for current page
      const from = (currentPage - 1) * postsPerPage;
      const to = from + postsPerPage - 1;

      if (serviceType === 'plagiarist') {
        const { data, error } = await supabase
          .from("posts_history")
          .select("*")
          .eq("bot_service_id", serviceId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        // Map and sort by views
        const mapped: Post[] = (data || []).map((post: any) => {
          const scrapingViews = post.scraping_stats?.views ?? 0;
          const mtprotoViews = post.mtproto_stats?.views ?? 0;
          return {
            id: post.id,
            content: post.post_content || "",
            views: Math.max(scrapingViews, mtprotoViews),
            reactions: post.reactions || 0,
            created_at: post.created_at,
            message_id: post.message_id,
            scraping_stats: post.scraping_stats,
            mtproto_stats: post.mtproto_stats,
          };
        }).sort((a, b) => b.views - a.views);

        setPosts(mapped.slice(0, postsPerPage));
      } else {
        const { data, error } = await supabase
          .from("ai_generated_posts")
          .select("*")
          .eq("ai_bot_service_id", serviceId)
          .eq("status", "published")
          .order("views", { ascending: false })
          .range(from, to);

        if (error) throw error;
        setPosts(data || []);
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

  const totalPages = Math.ceil(totalPosts / postsPerPage);

  const getPostLink = (messageId?: number) => {
    if (!messageId) return null;
    return `https://t.me/${channelName}/${messageId}`;
  };

  if (isLoading) return <Loading />;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Channel Header (identical to ChannelStats) */}
        <div className="mb-6">
          <Card className="glass-effect">
            <CardContent className="p-6">
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
                      <Users className="w-10 h-10 text-primary" />
                    </div>
                  )}
                </div>
                
                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h1 className="text-2xl font-bold mb-1 truncate">
                    {channelInfo?.title || channelName}
                  </h1>
                  
                  {/* Username & Status */}
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
                    <Badge variant="outline" className="flex-shrink-0">
                      {serviceType === 'ai' ? (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Бот
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 mr-1" />
                          Плагіат-бот
                        </>
                      )}
                    </Badge>
                    {channelInfo?.membersCount && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 flex-shrink-0">
                        <Users className="w-3 h-3 mr-1" />
                        {channelInfo.membersCount.toLocaleString()} підписників
                      </Badge>
                    )}
                  </div>
                  
                  {/* Subtitle */}
                  <h2 className="text-lg font-semibold">Топ публікацій</h2>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Posts List */}
        <div className="mt-8 space-y-4">
          {posts.map((post, index) => (
            <Card key={post.id} className="glass-effect">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Post Number */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                      (currentPage - 1) * postsPerPage + index + 1 <= 3
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {(currentPage - 1) * postsPerPage + index + 1}
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground mb-3 line-clamp-4">
                      {post.content || post.post_content}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        <span className="font-semibold">{post.views.toLocaleString()}</span>
                        <span>переглядів</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        <span className="font-semibold">{post.reactions.toLocaleString()}</span>
                        <span>реакцій</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(post.created_at).toLocaleDateString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Link to post */}
                  {getPostLink(post.message_id) && (
                    <div className="flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={getPostLink(post.message_id)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>
    </div>
  );
}
