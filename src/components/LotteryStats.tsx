import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Users, DollarSign, Clock, Award, Crown, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LotteryStatsData {
  totalRounds: number;
  totalPrizes: number;
  totalParticipants: number;
  avgParticipants: number;
  biggestWin: number;
  recentWinners: Array<{
    round_number: number;
    winner_prize: number;
    end_time: string;
    participants_count: number;
    winner_profile?: {
      full_name: string;
      avatar_url: string;
    };
  }>;
}

export const LotteryStats = () => {
  const [stats, setStats] = useState<LotteryStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      // Get overall statistics - only rounds with participants
      const { data: roundsData, error: roundsError } = await supabase
        .from("lottery_rounds")
        .select("winner_prize, participants_count")
        .eq("status", "completed")
        .gt("participants_count", 0);

      if (roundsError) throw roundsError;

      const totalRounds = roundsData?.length || 0;
      const totalPrizes = roundsData?.reduce((sum, r) => sum + (r.winner_prize || 0), 0) || 0;
      const totalParticipants = roundsData?.reduce((sum, r) => sum + (r.participants_count || 0), 0) || 0;
      const avgParticipants = totalRounds > 0 ? totalParticipants / totalRounds : 0;
      const biggestWin = roundsData?.reduce((max, r) => Math.max(max, r.winner_prize || 0), 0) || 0;

      // Get recent winners - only rounds with participants
      const { data: winnersData, error: winnersError } = await supabase
        .from("lottery_rounds")
        .select(`
          round_number,
          winner_prize,
          end_time,
          participants_count,
          winner_profile:profiles!lottery_rounds_winner_id_fkey(full_name, avatar_url)
        `)
        .eq("status", "completed")
        .not("winner_id", "is", null)
        .gt("participants_count", 0)
        .order("end_time", { ascending: false })
        .limit(10);

      if (winnersError) throw winnersError;

      const recentWinners = winnersData?.map(w => ({
        ...w,
        winner_profile: Array.isArray(w.winner_profile) ? w.winner_profile[0] : w.winner_profile
      })) || [];

      setStats({
        totalRounds,
        totalPrizes,
        totalParticipants,
        avgParticipants,
        biggestWin,
        recentWinners,
      });
    } catch (error) {
      console.error("Помилка завантаження статистики лотереї:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Статистика лотереї</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalRounds}</p>
                <p className="text-xs text-muted-foreground">Розіграшів</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalPrizes.toFixed(0)}₴</p>
                <p className="text-xs text-muted-foreground">Виплачено</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalParticipants}</p>
                <p className="text-xs text-muted-foreground">Учасників</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.biggestWin.toFixed(0)}₴</p>
                <p className="text-xs text-muted-foreground">Макс. виграш</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Winners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Історія переможців
          </CardTitle>
          <CardDescription>
            Останні 10 розіграшів
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {stats.recentWinners.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Поки немає розіграшів
                </p>
              ) : (
                stats.recentWinners.map((winner, index) => (
                  <div
                    key={winner.round_number}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Position Badge */}
                    <div className="flex-shrink-0">
                      {index === 0 ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold shadow-lg">
                          <Crown className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                          #{index + 1}
                        </div>
                      )}
                    </div>

                    {/* Winner Info */}
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={winner.winner_profile?.avatar_url} />
                      <AvatarFallback>
                        {winner.winner_profile?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {winner.winner_profile?.full_name || "Анонім"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(winner.end_time).toLocaleString("uk-UA", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                        +{winner.winner_prize.toFixed(2)}₴
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {winner.participants_count} 👥
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Average Stats */}
      <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-indigo-500" />
              <div>
                <p className="text-sm text-muted-foreground">Середній призовий фонд</p>
                <p className="text-2xl font-bold">
                  {stats.totalRounds > 0 ? (stats.totalPrizes / stats.totalRounds).toFixed(2) : 0}₴
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Середньо учасників</p>
              <p className="text-2xl font-bold">{stats.avgParticipants.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
