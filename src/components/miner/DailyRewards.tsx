import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Gift, Calendar, Check, Lock, Target, Gem, Coins, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyReward {
  day: number;
  coins: number;
  bonusBot?: string;
  icon: string;
}

const DAILY_REWARDS: DailyReward[] = [
  { day: 1, coins: 20, icon: "gift" },
  { day: 2, coins: 30, icon: "gift" },
  { day: 3, coins: 50, icon: "gift" },
  { day: 4, coins: 75, icon: "target" },
  { day: 5, coins: 150, icon: "gem" },
  { day: 6, coins: 300, icon: "coins" },
  { day: 7, coins: 500, bonusBot: "Базовий Майнер", icon: "sparkles" },
];

// Icon mapping helper
const getRewardIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    'gift': Gift,
    'target': Target,
    'gem': Gem,
    'coins': Coins,
    'sparkles': Sparkles,
  };
  return iconMap[iconName] || Gift;
};

interface DailyRewardsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRewardClaimed: () => void;
}

export const DailyRewards = ({ open, onOpenChange, onRewardClaimed }: DailyRewardsProps) => {
  const { toast } = useToast();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (open) {
      loadDailyRewardData();
    }
  }, [open]);

  const loadDailyRewardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("miner_daily_rewards")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setCurrentStreak(data.current_streak);
        setLastClaimDate(data.last_claim_date);

        // Check if can claim today
        const today = new Date().toISOString().split('T')[0];
        const canClaimToday = data.last_claim_date !== today;
        setCanClaim(canClaimToday);
      } else {
        // No data yet, user can claim
        setCanClaim(true);
        setCurrentStreak(0);
      }
    } catch (error) {
      console.error("Error loading daily rewards:", error);
    }
  };

  const claimDailyReward = async () => {
    if (!canClaim || claiming) return;

    setClaiming(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Determine new streak
      let newStreak = 1;
      if (lastClaimDate === yesterday) {
        // Continuing streak
        newStreak = Math.min(currentStreak + 1, 7);
      } else if (lastClaimDate && lastClaimDate < yesterday) {
        // Streak broken, restart
        newStreak = 1;
      }

      const reward = DAILY_REWARDS[newStreak - 1];

      // Update profile bonus_balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", user.id)
        .single();

      const newBalance = (profile?.bonus_balance || 0) + reward.coins;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ bonus_balance: newBalance })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update or insert daily reward record
      // First try to update existing record
      const { data: existingRecord } = await supabase
        .from("miner_daily_rewards")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("miner_daily_rewards")
          .update({
            current_streak: newStreak,
            last_claim_date: today,
            total_claims: (existingRecord.total_claims || 0) + 1
          })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("miner_daily_rewards")
          .insert({
            user_id: user.id,
            current_streak: newStreak,
            last_claim_date: today,
            total_claims: 1
          });

        if (insertError) throw insertError;
      }

      // If day 7, give bonus bot (add to miners_owned)
      if (newStreak === 7) {
        const { data: gameData } = await supabase
          .from("miner_game_data")
          .select("miners_owned")
          .eq("user_id", user.id)
          .single();

        if (gameData) {
          const minersOwned = gameData.miners_owned || {};
          if (!minersOwned['basic_miner']) {
            minersOwned['basic_miner'] = { level: 1, owned: 1 };
          } else {
            minersOwned['basic_miner'].owned += 1;
          }

          await supabase
            .from("miner_game_data")
            .update({ miners_owned: minersOwned })
            .eq("user_id", user.id);
        }
      }

      setCurrentStreak(newStreak);
      setLastClaimDate(today);
      setCanClaim(false);

      toast({
        title: `День ${newStreak} виконано!`,
        description: `Отримано ${reward.coins} монет!${reward.bonusBot ? ` + ${reward.bonusBot}` : ''}`,
        duration: 5000,
      });

      onRewardClaimed();

      // If completed week, reset
      if (newStreak === 7) {
        setTimeout(() => {
          toast({
            title: "Тиждень завершено!",
            description: "Стрік почнеться заново завтра!",
            duration: 5000,
          });
        }, 1000);
      }

    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Помилка",
        description: "Помилка при отриманні винагороди",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Calendar className="w-7 h-7 text-primary" />
            Щоденні Винагороди
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Streak info */}
          <Card className="p-4 bg-gradient-to-r from-primary/20 to-purple-500/20 border-primary/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Поточний стрік</p>
                <p className="text-3xl font-bold text-primary">{currentStreak} / 7 днів</p>
              </div>
              <Gift className="w-12 h-12 text-primary animate-pulse" />
            </div>
          </Card>

          {/* Rewards grid */}
          <div className="grid grid-cols-7 gap-3">
            {DAILY_REWARDS.map((reward) => {
              const isClaimed = currentStreak >= reward.day;
              const isToday = currentStreak + 1 === reward.day && canClaim;
              const isLocked = reward.day > currentStreak + 1;
              const IconComponent = getRewardIcon(reward.icon);

              return (
                <Card
                  key={reward.day}
                  className={cn(
                    "p-4 text-center transition-all cursor-pointer hover:scale-105",
                    isClaimed && "bg-green-500/20 border-green-500/50",
                    isToday && "bg-primary/20 border-primary ring-2 ring-primary animate-pulse",
                    isLocked && "opacity-50 grayscale"
                  )}
                >
                  <div className="mb-2 flex justify-center">
                    {isClaimed ? (
                      <Check className="w-8 h-8 text-green-500" />
                    ) : isToday ? (
                      <IconComponent className="w-8 h-8 text-primary animate-bounce" />
                    ) : isLocked ? (
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    ) : (
                      <IconComponent className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs font-semibold mb-1">День {reward.day}</p>
                  <p className="text-sm font-bold text-primary">{reward.coins}</p>
                  {reward.bonusBot && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      +{reward.bonusBot}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Claim button */}
          {canClaim ? (
            <Button
              onClick={claimDailyReward}
              disabled={claiming}
              className="w-full bg-gradient-primary text-lg py-6"
              size="lg"
            >
              {claiming ? (
                "Отримання..."
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  Отримати винагороду дня {currentStreak + 1}
                </>
              )}
            </Button>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                Ви вже отримали винагороду сьогодні!
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Повертайтеся завтра за новою винагородою
              </p>
            </div>
          )}

          {/* Info */}
          <Card className="p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground text-center">
              Заходьте щодня щоб отримувати винагороди!
              <br />
              Пропустіть день - стрік почнеться заново
            </p>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

