import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Clock, Users, Globe, FileText } from "lucide-react";

interface BotStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botId: string;
}

export const BotStatsDialog = ({ open, onOpenChange, botId }: BotStatsDialogProps) => {
  const [stats, setStats] = useState({
    botName: "",
    botUsername: "",
    usersCount: 0,
    channelsCount: 0,
    postsCount: 0,
    uptime: 0,
  });

  useEffect(() => {
    if (open && botId) {
      loadStats();
    }
  }, [open, botId]);

  const loadStats = async () => {
    try {
      const { data: bot, error } = await supabase
        .from("telegram_bots")
        .select("*")
        .eq("id", botId)
        .maybeSingle();

      if (error) throw error;

      if (bot) {
        // Отримуємо статистику з bot_stats таблиці
        const { data: botStats } = await supabase
          .from("bot_stats")
          .select("*")
          .eq("bot_id", botId)
          .maybeSingle();

        let usersCount = botStats?.total_users || 0;
        let channelsCount = botStats?.total_channels || 0;
        let postsCount = botStats?.total_published_posts || 0;

        // Calculate uptime percentage using the database function
        let uptime = 0;
        try {
          const { data: uptimeData, error } = await supabase
            .rpc("calculate_bot_uptime", { bot_id: botId });
          
          if (!error && uptimeData !== null) {
            uptime = uptimeData;
          }
        } catch (err) {
          console.warn("Failed to calculate uptime:", err);
        }

        setStats({
          botName: bot.bot_name || "Без імені",
          botUsername: bot.bot_username || "невідомо",
          usersCount,
          channelsCount,
          postsCount,
          uptime,
        });
      }
    } catch (error) {
      console.error("Error loading bot stats:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              {stats.botUsername && stats.botUsername !== "невідомо" ? (
                <>
                  <AvatarImage 
                    src={`https://t.me/i/userpic/320/${stats.botUsername}.jpg`} 
                    alt={stats.botName}
                  />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                    <Bot className="w-6 h-6" />
                  </AvatarFallback>
                </>
              ) : (
                <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                  <Bot className="w-6 h-6" />
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="font-bold text-lg">{stats.botName}</div>
              <div className="text-sm text-muted-foreground font-normal">
                @{stats.botUsername}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <Card className="p-4 glass-card border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Навантаження (Uptime)</div>
                <div className="text-lg font-bold">{stats.uptime}%</div>
              </div>
            </div>
          </Card>

          <Card className="p-4 glass-card border-success/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Користувачів</div>
                <div className="text-lg font-bold">{stats.usersCount}</div>
              </div>
            </div>
          </Card>

          <Card className="p-4 glass-card border-accent/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Каналів підключено</div>
                <div className="text-lg font-bold">{stats.channelsCount}</div>
              </div>
            </div>
          </Card>

          <Card className="p-4 glass-card border-warning/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Постів опубліковано</div>
                <div className="text-lg font-bold">{stats.postsCount}</div>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
