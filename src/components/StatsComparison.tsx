import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Globe, Eye, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StatsData {
  views: number;
  reactions?: number;
  forwards?: number;
  timestamp: string;
}

interface PostStats {
  postId: string;
  messageId: number;
  scraping_stats?: StatsData;
  mtproto_stats?: StatsData;
}

interface StatsComparisonProps {
  posts: PostStats[];
  channelInfo?: {
    participantsCount?: number;
    title?: string;
  };
}

export const StatsComparison = ({ posts, channelInfo }: StatsComparisonProps) => {
  const calculateDiff = (scraping: number = 0, mtproto: number = 0) => {
    if (mtproto === 0) return null;
    const diff = mtproto - scraping;
    const percentage = ((diff / mtproto) * 100).toFixed(1);
    return { diff, percentage };
  };

  const getDiffBadge = (diff: number, percentage: string) => {
    if (diff === 0) {
      return (
        <Badge variant="outline" className="gap-1">
          <Minus className="w-3 h-3" />
          {percentage}%
        </Badge>
      );
    }
    
    const isPositive = diff > 0;
    return (
      <Badge 
        variant={isPositive ? "default" : "outline"} 
        className={isPositive ? "bg-green-500 text-white gap-1" : "gap-1"}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? '+' : ''}{diff} ({percentage}%)
      </Badge>
    );
  };

  const postsWithBothStats = posts.filter(p => p.scraping_stats && p.mtproto_stats);
  const postsWithOnlyMtproto = posts.filter(p => !p.scraping_stats && p.mtproto_stats);
  const postsWithOnlyScraping = posts.filter(p => p.scraping_stats && !p.mtproto_stats);

  // Calculate average accuracy
  const avgAccuracy = postsWithBothStats.length > 0
    ? postsWithBothStats.reduce((sum, p) => {
        const scrapingViews = p.scraping_stats?.views || 0;
        const mtprotoViews = p.mtproto_stats?.views || 0;
        const accuracy = mtprotoViews > 0 ? (scrapingViews / mtprotoViews) * 100 : 100;
        return sum + accuracy;
      }, 0) / postsWithBothStats.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Порівняння методів збору
          </CardTitle>
          <CardDescription>
            Аналіз точності Web Scraping vs MTProto Userbot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-2xl font-bold text-green-600">{postsWithBothStats.length}</div>
              <div className="text-xs text-muted-foreground">Обидва методи</div>
            </div>
            
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-2xl font-bold text-purple-600">{postsWithOnlyMtproto.length}</div>
              <div className="text-xs text-muted-foreground">Тільки MTProto</div>
            </div>
            
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-2xl font-bold text-blue-600">{postsWithOnlyScraping.length}</div>
              <div className="text-xs text-muted-foreground">Тільки Scraping</div>
            </div>
            
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="text-2xl font-bold text-orange-600">{avgAccuracy.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Середня точність</div>
            </div>
          </div>

          {channelInfo && (
            <Alert>
              <Eye className="w-4 h-4" />
              <AlertDescription>
                <strong>{channelInfo.title || 'Канал'}</strong>
                {channelInfo.participantsCount && (
                  <span className="ml-2 text-muted-foreground">
                    • {channelInfo.participantsCount.toLocaleString()} підписників
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {postsWithBothStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Детальне порівняння</CardTitle>
            <CardDescription>Дані по кожному посту</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Пост ID</TableHead>
                    <TableHead>Метрика</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Globe className="w-4 h-4" />
                        Scraping
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="w-4 h-4" />
                        MTProto
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Різниця</TableHead>
                    <TableHead className="text-center">
                      <Clock className="w-4 h-4 mx-auto" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postsWithBothStats.map((post) => {
                    const scrapingViews = post.scraping_stats?.views || 0;
                    const mtprotoViews = post.mtproto_stats?.views || 0;
                    const viewsDiff = calculateDiff(scrapingViews, mtprotoViews);

                    const scrapingReactions = post.scraping_stats?.reactions || 0;
                    const mtprotoReactions = post.mtproto_stats?.reactions || 0;
                    const reactionsDiff = calculateDiff(scrapingReactions, mtprotoReactions);

                    const mtprotoForwards = post.mtproto_stats?.forwards || 0;

                    return (
                      <>
                        {/* Views Row */}
                        <TableRow key={`${post.postId}-views`}>
                          <TableCell rowSpan={3} className="font-mono text-xs">
                            #{post.messageId}
                          </TableCell>
                          <TableCell className="font-medium">Перегляди</TableCell>
                          <TableCell className="text-center">{scrapingViews.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-semibold">{mtprotoViews.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            {viewsDiff && getDiffBadge(viewsDiff.diff, viewsDiff.percentage)}
                          </TableCell>
                          <TableCell rowSpan={3} className="text-center text-xs text-muted-foreground">
                            {post.mtproto_stats?.timestamp && 
                              new Date(post.mtproto_stats.timestamp).toLocaleTimeString('uk-UA', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            }
                          </TableCell>
                        </TableRow>

                        {/* Reactions Row */}
                        <TableRow key={`${post.postId}-reactions`} className="border-b-0">
                          <TableCell className="font-medium">Реакції</TableCell>
                          <TableCell className="text-center">{scrapingReactions}</TableCell>
                          <TableCell className="text-center font-semibold">{mtprotoReactions}</TableCell>
                          <TableCell className="text-center">
                            {reactionsDiff && getDiffBadge(reactionsDiff.diff, reactionsDiff.percentage)}
                          </TableCell>
                        </TableRow>

                        {/* Forwards Row (MTProto only) */}
                        <TableRow key={`${post.postId}-forwards`}>
                          <TableCell className="font-medium">Пересилання</TableCell>
                          <TableCell className="text-center text-muted-foreground">—</TableCell>
                          <TableCell className="text-center font-semibold">{mtprotoForwards}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-purple-500/10">
                              Тільки MTProto
                            </Badge>
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      {postsWithBothStats.length === 0 && (
        <Alert>
          <AlertDescription>
            Ще немає даних для порівняння. Оберіть гібридний метод і зачекайте на збір статистики.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
