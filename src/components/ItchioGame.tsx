import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Play, Trophy, Dices, Gamepad2, Sparkles, Zap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { Roulette3DWrapper } from "@/components/Roulette3DWrapper";

interface ItchioGameProps {
  userId: string;
  currentBalance: number;
  onBalanceUpdate: () => void;
}

const GAMES = [
  {
    id: "roulette3d",
    name: "3D Рулетка",
    type: "roulette",
    description: "Професійна 3D рулетка з реалістичною графікою!"
  }
];

export function ItchioGame({ userId, currentBalance, onBalanceUpdate }: ItchioGameProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedGame, setSelectedGame] = useState(GAMES[0]);

  const handleStartGame = async () => {
    if (currentBalance < betAmount) {
      toast({
        title: "Недостатньо коштів",
        description: `Потрібно мінімум ${betAmount} бонусів`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Check balance again
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      
      if (!profile || profile.bonus_balance < betAmount) {
        toast({
          title: "Недостатньо коштів",
          description: "Оновіть сторінку і спробуйте ще раз",
          variant: "destructive",
        });
        return;
      }

      // Deduct bet from balance
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ bonus_balance: profile.bonus_balance - betAmount })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Create transaction
      await supabase.from("transactions").insert({
        user_id: userId,
        amount: -betAmount,
        type: "game_bet",
        description: "Ставка у грі",
        status: "completed",
      });

      setGameStarted(true);
      setIsPlaying(true);
      onBalanceUpdate();

      toast({
        title: "Гра розпочата!",
        description: `Ставка: ${betAmount} бонусів`,
      });
    } catch (error: any) {
      console.error("Error starting game:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося розпочати гру",
        variant: "destructive",
      });
    }
  };

  const handleGameResult = async (won: boolean, multiplier: number) => {
    try {
      if (won) {
        const winAmount = Math.floor(betAmount * multiplier);
        
        const { error } = await supabase
          .from("profiles")
          .update({ bonus_balance: currentBalance + winAmount })
          .eq("id", userId);

        if (error) throw error;

        await supabase.from("transactions").insert({
          user_id: userId,
          amount: winAmount,
          type: "game_win",
          description: `Виграш у грі (x${multiplier})`,
          status: "completed",
        });

        toast({
          title: "Перемога!",
          description: `Ви виграли ${winAmount} бонусів! (x${multiplier})`,
        });
      } else {
        toast({
          title: "Програш",
          description: "Спробуйте ще раз!",
          variant: "destructive",
        });
      }

      onBalanceUpdate();
      setGameStarted(false);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error processing result:", error);
    }
  };

  const presetBets = [10, 25, 50, 100];

  return (
    <div className="space-y-6">
      {/* Game Selection - Only show roulette */}
      {!isPlaying && (
        <div className="max-w-xl mx-auto">
          <Card className="relative overflow-hidden bg-gradient-to-br from-red-900/30 via-black/60 to-orange-900/30 border-red-500/50 hover:border-red-400/70 transition-all">
            {/* Animated background */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse"></div>
              <div className="absolute top-0 left-1/4 w-48 h-48 bg-red-500 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-orange-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <CardContent className="relative p-8 text-center space-y-4">
              {/* Animated Roulette Icon */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 blur-xl opacity-50 animate-pulse"></div>
                <div className="relative text-6xl transform hover:rotate-180 transition-transform duration-1000" style={{ animation: 'spin 10s linear infinite' }}>
                  <Sparkles className="w-16 h-16 mx-auto text-red-400" />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                  3D Європейська Рулетка
                </h2>
                <p className="text-sm text-muted-foreground">
                  Професійна 3D рулетка з реалістичною графікою
                </p>
              </div>

              {/* Balance Display */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="px-4 py-2 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-full border border-yellow-500/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400 animate-pulse" />
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Баланс</p>
                      <p className="text-lg font-bold text-yellow-400">
                        {currentBalance.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Play Button */}
              <Button
                onClick={() => {
                  setSelectedGame(GAMES[0]);
                  setIsPlaying(true);
                  setGameStarted(true);
                }}
                size="lg"
                className="w-full bg-gradient-to-r from-red-600 via-orange-600 to-red-600 hover:from-red-700 hover:via-orange-700 hover:to-red-700 text-white px-8 py-4 text-lg font-bold shadow-xl shadow-red-500/50 hover:shadow-red-500/70 transition-all transform hover:scale-105 border border-red-400/50"
              >
                <Play className="w-5 h-5 mr-2" />
                Почати гру
              </Button>

              {/* Features */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-red-500/20">
                <div className="space-y-1">
                  <Zap className="w-6 h-6 mx-auto text-red-400" />
                  <p className="text-xs font-semibold text-red-300">Миттєві виплати</p>
                </div>
                <div className="space-y-1">
                  <Shield className="w-6 h-6 mx-auto text-orange-400" />
                  <p className="text-xs font-semibold text-orange-300">Чесна гра</p>
                </div>
                <div className="space-y-1">
                  <Coins className="w-6 h-6 mx-auto text-yellow-400" />
                  <p className="text-xs font-semibold text-yellow-300">До x36</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Area - Only show when playing */}
      {isPlaying && (
        <Roulette3DWrapper
          userId={userId}
          currentBalance={currentBalance}
          onBalanceUpdate={onBalanceUpdate}
          betAmount={betAmount}
        />
      )}
    </div>
  );
}
