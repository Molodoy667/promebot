import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { Bot, Sparkles, Copy, Crown, Lock, Users, Radio, FileText, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface BotCategoriesPanelProps {
  bots: Array<{
    id: string;
    bot_name: string | null;
    bot_username: string | null;
    bot_type: 'ai' | 'plagiarist' | null;
    status: string | null;
    is_active: boolean | null;
    posts_count: number | null;
    channels_count: number | null;
    users_count?: number | null;
  }>;
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
}

export const BotCategoriesPanel = ({ bots, selectedBotId, onSelectBot }: BotCategoriesPanelProps) => {
  const [hasVip, setHasVip] = useState(false);
  const [botUptime, setBotUptime] = useState<Record<string, number>>({});

  useEffect(() => {
    checkVipStatus();
    loadBotUptime();
  }, [bots]);

  const checkVipStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: vipSub } = await supabase
      .from('vip_subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('expires_at', new Date().toISOString())
      .single();

    setHasVip(!!vipSub);
  };

  const loadBotUptime = async () => {
    const uptimeData: Record<string, number> = {};
    
    for (const bot of bots) {
      try {
        const { data, error } = await supabase
          .rpc('calculate_bot_uptime', { bot_id: bot.id });
        
        if (!error && data !== null) {
          uptimeData[bot.id] = data;
        } else {
          uptimeData[bot.id] = 0;
        }
      } catch (err) {
        uptimeData[bot.id] = 0;
      }
    }
    
    setBotUptime(uptimeData);
  };

  const aiBots = bots.filter(bot => bot.bot_type === 'ai');
  const plagiaristBots = bots.filter(bot => bot.bot_type === 'plagiarist' || !bot.bot_type);

  const handleBotClick = (bot: typeof bots[0], isLocked: boolean) => {
    if (isLocked) return;
    onSelectBot(bot.id);
  };

  const renderBotCard = (bot: typeof bots[0], isLocked: boolean = false) => {
    const isSelected = selectedBotId === bot.id;
    
    return (
      <Card
        key={bot.id}
        className={cn(
          "p-4 md:p-5 transition-all hover:shadow-glow relative overflow-hidden cursor-pointer rounded-2xl border border-border/60 bg-card/80 hover-scale flex flex-col h-56", 
          isSelected && "border-primary shadow-glow",
          isLocked && "opacity-60"
        )}
        onClick={() => handleBotClick(bot, isLocked)}
      >
        {isLocked && (
          <div className="absolute inset-0 backdrop-blur-[2px] bg-background/30 flex items-center justify-center z-10">
            <div className="text-center space-y-2">
              <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">VIP доступ</p>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarImage 
                src={bot.bot_username ? `https://t.me/i/userpic/320/${bot.bot_username}.jpg` : undefined}
                alt={bot.bot_name || "Bot"} 
              />
              <AvatarFallback className="bg-gradient-primary text-white">
                {bot.bot_type === 'ai' ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate" title={bot.bot_name || "Без імені"}>
                {bot.bot_name || bot.bot_username || "Без імені"}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                @{bot.bot_username || "невідомо"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <div>
                <span className="text-muted-foreground block">Користувачів:</span>
                <p className="font-semibold">{bot.users_count || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-primary" />
              <div>
                <span className="text-muted-foreground block">Каналів:</span>
                <p className="font-semibold">{bot.channels_count || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <div>
                <span className="text-muted-foreground block">Постів:</span>
                <p className="font-semibold">{bot.posts_count || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <div>
                <span className="text-muted-foreground block">Навантаження:</span>
                <p className="font-semibold">{botUptime[bot.id]?.toFixed(1) || 0}%</p>
              </div>
            </div>
          </div>

          <Badge 
            variant={bot.is_active ? "default" : "secondary"} 
            className="w-full justify-center"
          >
            {bot.is_active ? "Активний - натисніть для налаштувань" : "Неактивний - натисніть для налаштування"}
          </Badge>
        </div>
      </Card>
    );
  };

  const renderCategory = (
    title: string,
    description: string,
    icon: React.ReactNode,
    categoryBots: typeof bots,
    isVipRequired: boolean = false
  ) => {
    const shouldLockBots = isVipRequired && !hasVip;

    return (
      <div className="space-y-4">
        <Card className="p-6 glass-effect border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg">
              {icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold">{title}</h3>
                {isVipRequired && (
                  <Crown className="w-5 h-5 text-warning" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          </div>
        </Card>

        {shouldLockBots && (
          <Card className="p-4 border-warning/50 bg-warning/5">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Доступно лише для VIP користувачів</p>
                <p className="text-xs text-muted-foreground">
                  Оформіть VIP підписку щоб отримати доступ до AI ботів
                </p>
              </div>
            </div>
          </Card>
        )}

        {categoryBots.length === 0 ? (
          <Card className="p-8 text-center glass-effect">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Немає ботів цієї категорії</p>
          </Card>
        ) : (
          <Carousel className="w-full" opts={{ align: "start", loop: false }}>
            <CarouselContent className="-ml-2 md:-ml-4">
              {categoryBots.map((bot) => (
                <CarouselItem key={bot.id} className="pl-2 md:pl-4 basis-full md:basis-1/3 lg:basis-1/4">
                  {renderBotCard(bot, shouldLockBots)}
                </CarouselItem>
              ))}
            </CarouselContent>
            {categoryBots.length > 1 && (
              <>
                <CarouselPrevious className="-left-2 md:-left-4 z-10 bg-background/95 backdrop-blur-xl border border-border/60 hover:bg-background w-12 h-12 rounded-full shadow-lg" />
                <CarouselNext className="-right-2 md:-right-4 z-10 bg-background/95 backdrop-blur-xl border border-border/60 hover:bg-background w-12 h-12 rounded-full shadow-lg" />
              </>
            )}
          </Carousel>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {renderCategory(
        "Боти АІ",
        "Ці боти автоматично генерують контент, шукають готовий контент в інтернеті та публікують у вашому каналі",
        <Sparkles className="w-6 h-6 text-white" />,
        aiBots,
        true
      )}
 
      {renderCategory(
        "Боти Плагіатори",
        "Ці боти копіюють контент з публічних та приватних каналів та мають безліч фільтрів",
        <Copy className="w-6 h-6 text-white" />,
        plagiaristBots,
        false
      )}
    </div>
  );
};
