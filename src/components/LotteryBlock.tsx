import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BonusBalanceDisplay } from "./BonusBalanceDisplay";
import { Ticket, Users, Trophy, Clock, Sparkles, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

console.log('LotteryBlock loaded');

interface LotteryRound {
  id: string;
  prize_pool: number;
  participants_count: number;
  start_time: string;
  status: string;
}

interface LastWinner {
  id: string;
  winner_id: string;
  winner_prize: number;
  end_time: string;
  winner_profile?: {
    full_name: string;
    avatar_url: string;
  };
}

interface LotterySettings {
  ticket_price: number;
  draw_interval_hours: number;
  is_enabled: boolean;
}

export const LotteryBlock = ({ userId, userBalance }: { userId: string; userBalance: number }) => {
  const { toast } = useToast();
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [lastWinner, setLastWinner] = useState<LastWinner | null>(null);
  const [settings, setSettings] = useState<LotterySettings | null>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    fetchLotteryData();
    
    // Refresh data every 10 seconds
    const interval = setInterval(fetchLotteryData, 10000);
    
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    console.log('Timer effect triggered', { activeRound, settings, timeRemaining });
    if (activeRound && settings) {
      updateTimeRemaining();
      const timer = setInterval(updateTimeRemaining, 1000);
      return () => clearInterval(timer);
    }
  }, [activeRound, settings]);

  const updateTimeRemaining = () => {
    if (!activeRound || !settings) {
      console.log('No activeRound or settings', { activeRound, settings });
      return;
    }

    const startTime = new Date(activeRound.start_time).getTime();
    const now = Date.now();
    const drawInterval = settings.draw_interval_hours * 60 * 60 * 1000;
    const elapsed = now - startTime;
    const remaining = drawInterval - elapsed;

    console.log('Timer calculation', { startTime, now, drawInterval, elapsed, remaining });

    if (remaining <= 0) {
      setTimeRemaining("Розіграш зараз...");
      return;
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    console.log('Setting time:', timeStr);
    setTimeRemaining(timeStr);
  };

  const fetchLotteryData = async () => {
    try {
      // Get settings
      const { data: settingsData } = await supabase
        .from("lottery_settings")
        .select("*")
        .limit(1)
        .single();

      setSettings(settingsData);

      // Get active round
      const { data: roundData } = await supabase
        .from("lottery_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveRound(roundData);

      // Check if user has ticket
      if (roundData) {
        const { data: ticketData } = await supabase
          .from("lottery_tickets")
          .select("*")
          .eq("user_id", userId)
          .eq("round_id", roundData.id)
          .maybeSingle();

        setHasTicket(!!ticketData);
      }

      // Get last winner
      const { data: lastWinnerData } = await supabase
        .from("lottery_rounds")
        .select(`
          id,
          winner_id,
          winner_prize,
          end_time,
          winner_profile:profiles!lottery_rounds_winner_id_fkey(full_name, avatar_url)
        `)
        .eq("status", "completed")
        .not("winner_id", "is", null)
        .order("end_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWinnerData) {
        setLastWinner({
          ...lastWinnerData,
          winner_profile: Array.isArray(lastWinnerData.winner_profile) 
            ? lastWinnerData.winner_profile[0] 
            : lastWinnerData.winner_profile
        });
      }

    } catch (error) {
      console.error("Помилка завантаження даних лотереї:", error);
    }
  };

  const purchaseTicket = async () => {
    if (!settings || !activeRound) {
      console.log('No settings or active round', { settings, activeRound });
      return;
    }

    console.log('Attempting to purchase ticket', { 
      userBalance, 
      ticketPrice: settings.ticket_price,
      hasEnough: userBalance >= settings.ticket_price 
    });

    if (userBalance < settings.ticket_price) {
      toast({
        title: "Недостатньо коштів",
        description: `Потрібно мінімум бонусів на балансі`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('Calling purchase_lottery_ticket RPC...');
      const { data, error } = await supabase.rpc("purchase_lottery_ticket");

      console.log('RPC response:', { data, error });

      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      const result = data as { success: boolean; error?: string };

      if (result.success) {
        const successMsg = "✅ Квиток куплено!\nУдачі у розіграші!";
        navigator.clipboard.writeText(successMsg);
        toast({
          title: "✅ Квиток куплено!",
          description: (
            <div className="flex items-center gap-2">
              <span>Удачі у розіграші!</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(successMsg);
                  toast({ title: "📋 Скопійовано" });
                }}
              >
                📋
              </Button>
            </div>
          ),
        });
        fetchLotteryData();
        // Trigger balance update in parent
        window.dispatchEvent(new Event("balanceUpdate"));
      } else {
        console.error('Purchase failed:', result.error);
        const errorMsg = `Помилка\n${result.error || "Не вдалося купити квиток"}`;
        toast({
          title: "Помилка",
          description: (
            <div className="flex items-center gap-2">
              <span className="flex-1">{result.error || "Не вдалося купити квиток"}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(errorMsg);
                  toast({ title: "📋 Скопійовано" });
                }}
              >
                📋
              </Button>
            </div>
          ),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error purchasing ticket:", error);
      const errorMsg = `Помилка\n${error.message || "Сталася помилка"}`;
      toast({
        title: "Помилка",
        description: (
          <div className="flex items-center gap-2">
            <span className="flex-1">{error.message || "Сталася помилка"}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(errorMsg);
                toast({ title: "📋 Скопійовано" });
              }}
            >
              📋
            </Button>
          </div>
        ),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!settings || !settings.is_enabled) {
    return null;
  }

  const displayPrize = activeRound 
    ? (activeRound.participants_count <= 1 
        ? activeRound.prize_pool * 2 
        : activeRound.prize_pool)
    : 0;

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-500/20 overflow-hidden">
      <CardHeader className="relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-500" />
            <CardTitle className="text-2xl">Лотерея</CardTitle>
          </div>
          {activeRound && timeRemaining && (
            <Badge variant="outline" className="flex items-center gap-1 text-sm">
              <Clock className="w-3 h-3" />
              {timeRemaining}
            </Badge>
          )}
          {activeRound && !timeRemaining && (
            <Badge variant="outline" className="flex items-center gap-1 text-sm">
              <Clock className="w-3 h-3" />
              Завантаження...
            </Badge>
          )}
        </div>
        <CardDescription>
          Купи квиток і виграй джекпот! Розіграш щогодини
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Prize Pool */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-4 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Джекпот</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-yellow-500">
                <BonusBalanceDisplay amount={displayPrize} iconSize={32} />
              </div>
              {activeRound && activeRound.participants_count === 1 && (
                <div className="text-xs text-yellow-500/80 flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3" />
                  Подвоєний приз!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Учасників</span>
            </div>
            <div className="text-xl font-bold">
              {activeRound?.participants_count || 0}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="font-bold">₴</span>
              <span className="text-xs">Ціна квитка</span>
            </div>
            <div className="text-xl font-bold">
              <BonusBalanceDisplay amount={settings.ticket_price} iconSize={20} showIcon={false} />
            </div>
          </div>
        </div>

        {/* Last Winner */}
        {lastWinner && (
          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={lastWinner.winner_profile?.avatar_url} />
                <AvatarFallback>
                  {lastWinner.winner_profile?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Останній переможець</div>
                <div className="font-semibold truncate">
                  {lastWinner.winner_profile?.full_name || "Анонім"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-500">
                  +<BonusBalanceDisplay amount={lastWinner.winner_prize} iconSize={16} showIcon={false} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(lastWinner.end_time).toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Button */}
        <Button
          onClick={purchaseTicket}
          disabled={isLoading || hasTicket || !activeRound}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          size="lg"
        >
          {hasTicket ? (
            <>
              <Ticket className="w-5 h-5 mr-2" />
              У вас є квиток
            </>
          ) : (
            <>
              <Ticket className="w-5 h-5 mr-2" />
              Купити квиток за <BonusBalanceDisplay amount={settings.ticket_price} iconSize={16} showIcon={false} />
            </>
          )}
        </Button>

        {hasTicket && (
          <p className="text-xs text-center text-muted-foreground">
            Ви берете участь у поточному розіграші. Удачі!
          </p>
        )}

        {activeRound && activeRound.participants_count === 0 && (
          <p className="text-xs text-center text-yellow-500">
            Будьте першим - отримайте подвоєний приз!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
