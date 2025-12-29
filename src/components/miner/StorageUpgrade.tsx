import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { Archive, Clock, Coins, TrendingUp, Sparkles } from "lucide-react";

interface StorageUpgradeProps {
  storageLevel: number;
  storageMaxHours: number;
  userBalance: number;
  onUpgrade: () => void;
}

export const StorageUpgrade = ({ 
  storageLevel, 
  storageMaxHours, 
  userBalance,
  onUpgrade 
}: StorageUpgradeProps) => {
  const { toast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Calculate next level stats
  const nextLevel = storageLevel + 1;
  const upgradeCost = Math.floor(100 * Math.pow(1.5, nextLevel - 2));
  const nextMaxHours = 6 + (nextLevel - 1) * 2;
  const canAfford = userBalance >= upgradeCost;

  const handleUpgrade = async () => {
    if (!canAfford) {
      toast({
        title: "Недостатньо коштів",
        description: `Потрібно ${upgradeCost} бонусних монет`,
        variant: "destructive",
      });
      return;
    }

    setIsUpgrading(true);

    try {
      const { data, error } = await supabase.rpc("upgrade_miner_storage");

      if (error) throw error;

      const result = data as { success: boolean; error?: string; new_level?: number; new_max_hours?: number };

      if (result.success) {
        toast({
          title: "✅ Сховище покращено!",
          description: `Рівень ${result.new_level}: ${result.new_max_hours}год накопичення`,
        });
        onUpgrade();
      } else {
        throw new Error(result.error || "Помилка покращення");
      }
    } catch (error: any) {
      console.error("Error upgrading storage:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося покращити сховище",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Archive className="w-6 h-6 text-orange-500" />
        Покращення Сховища
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Level Card */}
        <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-2 border-orange-500/30">
          <div className="text-center">
            <Archive className="w-16 h-16 mx-auto text-orange-500 mb-4" />
            <h3 className="font-bold text-lg mb-2">Поточний рівень</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Рівень</p>
                <p className="text-3xl font-bold text-primary">{storageLevel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Максимум накопичення</p>
                <p className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  {storageMaxHours} годин
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Next Level Card */}
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30">
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <Archive className="w-16 h-16 text-green-500" />
              <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h3 className="font-bold text-lg mb-2">Наступний рівень</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Рівень</p>
                <p className="text-3xl font-bold text-green-500">{nextLevel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Максимум накопичення</p>
                <p className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5 text-green-500" />
                  {nextMaxHours} годин
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-green-500 mt-1">
                  <TrendingUp className="w-4 h-4" />
                  +{nextMaxHours - storageMaxHours} годин
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Upgrade Info */}
      <div className="mt-6 space-y-4">
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Вартість покращення</p>
              <p className="text-xl font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <BonusBalanceDisplay amount={upgradeCost} iconSize={20} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Ваш баланс</p>
              <p className={`text-xl font-bold ${!canAfford ? "text-destructive" : ""}`}>
                <BonusBalanceDisplay amount={userBalance} iconSize={20} />
              </p>
            </div>
          </div>
          {!canAfford && (
            <p className="text-sm text-destructive mt-2 text-center">
              Недостатньо коштів для покращення
            </p>
          )}
        </Card>

        <Button
          onClick={handleUpgrade}
          disabled={!canAfford || isUpgrading}
          className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:opacity-90 text-white font-bold text-lg py-6"
          size="lg"
        >
          {isUpgrading ? (
            "Покращення..."
          ) : (
            <span className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Покращити сховище
            </span>
          )}
        </Button>

        {/* Benefits List */}
        <Card className="p-4 bg-blue-500/10 border-blue-500/30">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Переваги покращення:
          </h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Більше часу для накопичення монет</li>
            <li>• Менше потреби заходити в гру</li>
            <li>• Збільшення пасивного доходу</li>
          </ul>
        </Card>
      </div>
    </Card>
  );
};
