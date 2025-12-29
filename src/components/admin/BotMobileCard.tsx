import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Bot, Edit, Trash2, TestTube2, BarChart3, Sparkles, Copy, FileText, Radio, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelegramBot {
  id: string;
  user_id: string;
  bot_token: string;
  bot_username: string | null;
  bot_name: string | null;
  webhook_url: string | null;
  is_active: boolean;
  status: string;
  posts_count: number;
  channels_count: number;
  last_activity_at: string | null;
  created_at: string;
  bot_type: 'ai' | 'plagiarist' | null;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface BotMobileCardProps {
  bot: TelegramBot;
  onEdit: (bot: TelegramBot) => void;
  onDelete: (id: string) => void;
  onTest: (bot: TelegramBot) => void;
  onStats: (bot: TelegramBot) => void;
  isTesting?: boolean;
}

export const BotMobileCard = ({ bot, onEdit, onDelete, onTest, onStats, isTesting }: BotMobileCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with Avatar and Name */}
          <div className="flex items-start gap-3">
            <Avatar className="w-12 h-12 border-2 border-border">
              <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${bot.bot_username || bot.id}`} />
              <AvatarFallback>
                <Bot className="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{bot.bot_name || "Бот без імені"}</h3>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "gap-1",
                    bot.bot_type === 'ai' && "border-primary/30 bg-primary/5 text-primary",
                    (!bot.bot_type || bot.bot_type === 'plagiarist') && "border-secondary/30 bg-secondary/5"
                  )}
                >
                  {bot.bot_type === 'ai' ? (
                    <>
                      <Sparkles className="w-3 h-3" />
                      AI
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Плагіат
                    </>
                  )}
                </Badge>
              </div>
              {bot.bot_username && (
                <p className="text-sm text-muted-foreground">@{bot.bot_username}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Статус</span>
            {bot.is_active ? (
              <Badge className="bg-success/20 text-success border-success/30 text-xs">
                Активний
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Неактивний
              </Badge>
            )}
          </div>

          {/* Owner */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Власник</span>
            <div className="text-right">
              <p className="text-sm font-medium">{bot.profiles?.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{bot.profiles?.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Постів</p>
                <p className="text-sm font-semibold">{bot.posts_count}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Radio className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Каналів</p>
                <p className="text-sm font-semibold">{bot.channels_count}</p>
              </div>
            </div>
          </div>

          {/* Last Activity */}
          {bot.last_activity_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Остання активність</span>
              <span className="text-xs text-muted-foreground">
                {new Date(bot.last_activity_at).toLocaleDateString("uk-UA", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(bot)}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube2 className="w-4 h-4 mr-2" />
              )}
              Тест
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStats(bot)}
              className="w-full"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Статистика
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(bot)}
              className="w-full"
            >
              <Edit className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(bot.id)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Видалити
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
