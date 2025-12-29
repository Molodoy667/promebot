import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface BotSelectorProps {
  bots: Array<{
    id: string;
    bot_name: string | null;
    bot_username: string | null;
    bot_type?: 'ai' | 'plagiarist' | null;
    status: string | null;
    is_active: boolean | null;
    posts_count: number | null;
    channels_count: number | null;
    last_activity_at: string | null;
    users_count?: number | null;
  }>;
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
}

export const BotSelector = ({ bots, selectedBotId, onSelectBot }: BotSelectorProps) => {
  const [uptimeData, setUptimeData] = useState<Record<string, number>>({});

  useEffect(() => {
    // Calculate uptime for all bots
    const calculateUptimes = async () => {
      const uptimes: Record<string, number> = {};
      
      for (const bot of bots) {
        try {
          const { data, error } = await supabase.rpc('calculate_bot_uptime', {
            bot_id: bot.id
          });
          
          if (!error && data !== null) {
            uptimes[bot.id] = data;
          } else {
            // Fallback to 0 if calculation fails
            console.warn(`Failed to calculate uptime for bot ${bot.id}:`, error);
            uptimes[bot.id] = 0;
          }
        } catch (error) {
          // Silent fallback - don't spam console
          uptimes[bot.id] = 0;
        }
      }
      
      setUptimeData(uptimes);
    };
    
    if (bots.length > 0) {
      calculateUptimes();
    }
  }, [bots]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Оберіть бота для керування</h2>
      <p className="text-muted-foreground">
        Виберіть бота, яким ви хочете керувати. Перевірте його статистику перед використанням.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bots.map((bot) => {
          const isSelected = selectedBotId === bot.id;
          const uptime = uptimeData[bot.id] || 0;

          return (
            <Card
              key={bot.id}
              className={cn(
                "p-6 cursor-pointer transition-all hover:shadow-lg",
                isSelected && "border-primary shadow-glow"
              )}
              onClick={() => onSelectBot(bot.id)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold">{bot.bot_name || "Без імені"}</h3>
                      <p className="text-sm text-muted-foreground">
                        @{bot.bot_username || "невідомо"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium backdrop-blur-xl",
                      bot.is_active
                        ? "bg-success/20 text-success border border-success/30"
                        : "bg-muted/30 text-muted-foreground border border-border/30"
                    )}
                  >
                    {bot.is_active ? "Активний" : "Неактивний"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Користувачів</span>
                    </div>
                    <p className="text-lg font-bold">
                      {bot.users_count || 0}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs">Uptime</span>
                    </div>
                    <p className="text-lg font-bold">{uptime}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs">Постів</span>
                    </div>
                    <p className="text-base font-semibold">
                      {bot.posts_count || 0}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bot className="w-4 h-4" />
                      <span className="text-xs">Каналів</span>
                    </div>
                    <p className="text-base font-semibold">{bot.channels_count || 0}</p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ім'я користувача:</span>
                    <span className="font-medium">@{bot.bot_username || "невідомо"}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Активність:</span>
                    <span className="font-medium">{bot.is_active ? "Активний" : "Неактивний"}</span>
                  </div>
                </div>

                <Button
                  className={cn(
                    "w-full",
                    isSelected && "bg-gradient-primary hover:opacity-90"
                  )}
                  variant={isSelected ? "default" : "outline"}
                >
                  {isSelected ? "Обрано" : "Обрати"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {bots.length === 0 && (
        <Card className="p-8 text-center">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            У вас ще немає ботів. Створіть бота, щоб почати роботу.
          </p>
          <Button 
            onClick={() => window.location.href = '/my-channels'}
            className="bg-gradient-primary hover:opacity-90"
          >
            Додати бота
          </Button>
        </Card>
      )}
    </div>
  );
};
