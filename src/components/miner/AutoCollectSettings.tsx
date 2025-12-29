import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Zap, Clock, Crown, Check, Lock, Settings, Rocket, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoCollectLevel {
  level: number;
  name: string;
  interval: string;
  intervalMinutes: number;
  cost: number;
  icon: string;
  color: string;
}

const AUTO_COLLECT_LEVELS: AutoCollectLevel[] = [
  { 
    level: 1, 
    name: "Базовий", 
    interval: "Кожні 5 хвилин", 
    intervalMinutes: 5,
    cost: 0, 
    icon: "settings", 
    color: "from-slate-500/10 to-slate-600/10 border-slate-500/30" 
  },
  { 
    level: 2, 
    name: "Швидкий", 
    interval: "Кожні 3 хвилини", 
    intervalMinutes: 3,
    cost: 10000, 
    icon: "zap", 
    color: "from-blue-500/10 to-cyan-500/10 border-blue-500/30" 
  },
  { 
    level: 3, 
    name: "Турбо", 
    interval: "Кожну хвилину", 
    intervalMinutes: 1,
    cost: 50000, 
    icon: "rocket", 
    color: "from-purple-500/10 to-pink-500/10 border-purple-500/30" 
  },
  { 
    level: 4, 
    name: "Преміум", 
    interval: "Кожні 30 секунд", 
    intervalMinutes: 0.5,
    cost: 100000, 
    icon: "crown", 
    color: "from-yellow-500/10 to-orange-500/10 border-yellow-500/30" 
  },
];

// Icon mapping helper
const getAutoCollectIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    'settings': Settings,
    'zap': Zap,
    'rocket': Rocket,
    'crown': Crown,
  };
  return iconMap[iconName] || Settings;
};

interface AutoCollectSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoCollectEnabled: boolean;
  autoCollectLevel: number;
  userBalance: number;
  onUpdate: () => void;
  isVip?: boolean;
}

export const AutoCollectSettings = ({ 
  open, 
  onOpenChange, 
  autoCollectEnabled,
  autoCollectLevel,
  userBalance,
  onUpdate,
  isVip = false
}: AutoCollectSettingsProps) => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(autoCollectEnabled);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const toggleAutoCollect = async () => {
    if (!isVip) {
      toast({
        title: "VIP функція",
        description: "Автозбір доступний тільки для VIP користувачів",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("miner_game_data")
        .update({ auto_collect_enabled: !enabled })
        .eq("user_id", user.id);

      if (error) throw error;

      setEnabled(!enabled);
      toast({
        title: "Успішно",
        description: !enabled ? "Автозбір увімкнено" : "Автозбір вимкнено",
      });
      onUpdate();
    } catch (error) {
      console.error("Error toggling auto-collect:", error);
      toast({
        title: "Помилка",
        description: "Помилка зміни налаштувань",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const upgradeAutoCollect = async (level: number) => {
    if (!isVip) {
      toast({
        title: "VIP функція",
        description: "Покращення автозбору доступні тільки для VIP користувачів",
        variant: "destructive",
      });
      return;
    }
    
    if (level <= autoCollectLevel) return;

    const levelData = AUTO_COLLECT_LEVELS[level - 1];
    
    if (userBalance < levelData.cost) {
      toast({
        title: "Недостатньо монет",
        description: "Недостатньо монет для покращення!",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpgrading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Deduct cost from balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ bonus_balance: userBalance - levelData.cost })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update auto-collect level
      const { error } = await supabase
        .from("miner_game_data")
        .update({ 
          auto_collect_level: level,
          auto_collect_enabled: true 
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: `Покращено до рівня ${level}!`,
        description: `Тепер збір ${levelData.interval.toLowerCase()}`,
      });

      onUpdate();
    } catch (error) {
      console.error("Error upgrading auto-collect:", error);
      toast({
        title: "Помилка",
        description: "Помилка покращення",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Zap className="w-7 h-7 text-primary" />
            Автоматичний Збір
          </DialogTitle>
          <DialogDescription>
            {isVip ? (
              "Автоматичний збір намайнених монет без необхідності натискати кнопку"
            ) : (
              <span className="text-orange-500 font-semibold flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Функція доступна тільки для VIP користувачів
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Toggle */}
          <Card className="p-4 bg-primary/10 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold">Автозбір</p>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? "Увімкнено" : "Вимкнено"}
                  </p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={toggleAutoCollect}
                disabled={saving || !isVip}
              />
            </div>
          </Card>

          {/* Current Level */}
          {enabled && (
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Поточний рівень</p>
                  <p className="text-2xl font-bold">
                    {AUTO_COLLECT_LEVELS[autoCollectLevel - 1].icon} {AUTO_COLLECT_LEVELS[autoCollectLevel - 1].name}
                  </p>
                  <p className="text-sm text-primary mt-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {AUTO_COLLECT_LEVELS[autoCollectLevel - 1].interval}
                  </p>
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  Рівень {autoCollectLevel}
                </Badge>
              </div>
            </Card>
          )}

          {/* Upgrade Options */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Покращення Автозбору</h3>
            <div className="grid grid-cols-1 gap-4">
              {AUTO_COLLECT_LEVELS.map((level) => {
                const isOwned = level.level <= autoCollectLevel;
                const isCurrent = level.level === autoCollectLevel;
                const canAfford = userBalance >= level.cost;
                const isNext = level.level === autoCollectLevel + 1;

                return (
                  <Card
                    key={level.level}
                    className={cn(
                      "p-5 transition-all bg-gradient-to-br",
                      level.color,
                      isOwned && "ring-2 ring-primary",
                      isCurrent && "shadow-glow"
                    )}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            {(() => {
                              const IconComponent = getAutoCollectIcon(level.icon);
                              return <IconComponent className="w-12 h-12 text-primary" />;
                            })()}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{level.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Рівень {level.level}
                            </p>
                          </div>
                        </div>
                        {isOwned && (
                          <Check className="w-6 h-6 text-green-500" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>{level.interval}</span>
                        </div>
                        
                        {level.level === 4 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            <span>Преміум рівень</span>
                          </div>
                        )}
                      </div>

                      {/* Price / Action */}
                      <div className="pt-3 border-t border-border/30">
                        {level.cost === 0 ? (
                          <Badge variant="secondary" className="w-full justify-center py-2">
                            Безкоштовно
                          </Badge>
                        ) : isOwned ? (
                          <Badge variant="default" className="w-full justify-center py-2">
                            ✓ Куплено
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => upgradeAutoCollect(level.level)}
                            disabled={!isNext || !canAfford || upgrading || !isVip}
                            className="w-full"
                            variant={isNext && canAfford && isVip ? "default" : "secondary"}
                          >
                            {!isNext ? (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Заблоковано
                              </>
                            ) : !canAfford ? (
                              <>Недостатньо ({level.cost.toLocaleString()})</>
                            ) : (
                              <>Купити за {level.cost.toLocaleString()}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <Card className="p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground text-center">
              Автозбір працює в фоновому режимі
              <br />
              Покращуйте рівень для більш частого збору
            </p>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

