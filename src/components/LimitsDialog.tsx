import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Bot, FileText, Clock, Radio, Layers } from "lucide-react";

interface LimitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  subscription: any;
}

export function LimitsDialog({ open, onOpenChange, userId, subscription }: LimitsDialogProps) {
  const [channelsCount, setChannelsCount] = useState(0);
  const [todayPostsCount, setTodayPostsCount] = useState(0);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [botsCount, setBotsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      loadLimitsData();
    }
  }, [open, userId]);

  const loadLimitsData = async () => {
    setIsLoading(true);
    try {
      // Отримуємо кешовані дані з profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("bots_used_count, channels_used_count, sources_used_count, posts_current_period")
        .eq("id", userId)
        .single();

      if (!profileError && profileData) {
        setBotsCount(profileData.bots_used_count || 0);
        setChannelsCount(profileData.channels_used_count || 0);
        setSourcesCount(profileData.sources_used_count || 0);
        setTodayPostsCount(profileData.posts_current_period || 0);
      }
    } catch (error) {
      console.error("Error loading limits data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const channelsLimit = subscription?.tariffs?.channels_limit || 0;
  const postsLimit = subscription?.tariffs?.posts_per_month || 0;
  const sourcesLimit = subscription?.tariffs?.sources_limit || 0;
  const botsLimit = subscription?.tariffs?.bots_limit || 0;

  const channelsPercentage = channelsLimit > 0 ? (channelsCount / channelsLimit) * 100 : 0;
  const postsPercentage = postsLimit > 0 ? (todayPostsCount / postsLimit) * 100 : 0;
  const sourcesPercentage = sourcesLimit > 0 ? (sourcesCount / sourcesLimit) * 100 : 0;
  const botsPercentage = botsLimit > 0 ? (botsCount / botsLimit) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ліміти тарифу</DialogTitle>
          <DialogDescription>
            Ваші поточні ліміти згідно з обраним тарифом
          </DialogDescription>
        </DialogHeader>
        
        {!subscription ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>У вас немає активного тарифу</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Channels Limit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="font-medium">Цільові канали</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {isLoading ? "..." : `${channelsCount}/${channelsLimit}`}
                </span>
              </div>
              <Progress value={channelsPercentage} className="h-2" />
            </div>

            {/* Sources Limit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary" />
                  <span className="font-medium">Джерельні канали</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {isLoading ? "..." : `${sourcesCount}/${sourcesLimit}`}
                </span>
              </div>
              <Progress value={sourcesPercentage} className="h-2" />
            </div>

            {/* Bots Limit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="font-medium">Telegram боти</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {isLoading ? "..." : `${botsCount}/${botsLimit}`}
                </span>
              </div>
              <Progress value={botsPercentage} className="h-2" />
            </div>

            {/* Posts Limit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">Публікацій за місяць</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {isLoading ? "..." : `${todayPostsCount}/${postsLimit}`}
                </span>
              </div>
              <Progress value={postsPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Оновлення щомісяця
              </p>
            </div>

            {/* Tariff Info */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Поточний тариф:</span>
                <span className="font-medium">{subscription.tariffs?.name}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

