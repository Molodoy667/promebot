import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { RefreshCw, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SourceChannelStatsProps {
  sourceChannelId: string;
  channelUsername: string;
  channelTitle?: string;
  spyId?: string;
  isPrivate?: boolean;
}

export const SourceChannelStats = ({ 
  sourceChannelId, 
  channelUsername, 
  channelTitle,
  spyId,
  isPrivate 
}: SourceChannelStatsProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const handleSyncStats = async () => {
    if (!spyId) {
      toast({
        title: "Юзербот не підключений",
        description: "Для збору статистики потрібен активний юзербот",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-source-channel-stats', {
        body: {
          sourceChannelId,
          channelIdentifier: channelUsername,
          spyId,
        }
      });

      if (error) throw error;

      if (data?.success) {
        setStats(data.stats);
        toast({
          title: "Статистика оновлена",
          description: `${data.stats.messagesCount} постів • ${data.stats.membersCount.toLocaleString()} підписників`,
        });
      }
    } catch (error: any) {
      console.error("Error syncing source channel stats:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося оновити статистику",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPrivate && <Badge variant="secondary">🔒 Приватний</Badge>}
            {channelTitle || channelUsername}
          </div>
          <Button
            onClick={handleSyncStats}
            disabled={isLoading || !spyId}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Оновити
          </Button>
        </CardTitle>
        <CardDescription>{channelUsername}</CardDescription>
      </CardHeader>
      
      {stats && (
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.membersCount.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Підписників</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.messagesCount}</div>
                <div className="text-sm text-muted-foreground">Постів</div>
              </div>
            </div>
          </div>
          
          {stats.lastSync && (
            <div className="mt-4 text-xs text-muted-foreground">
              Оновлено: {new Date(stats.lastSync).toLocaleString('uk-UA')}
            </div>
          )}
        </CardContent>
      )}
      
      {!stats && !spyId && (
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Юзербот не підключений до цього каналу
          </div>
        </CardContent>
      )}
    </Card>
  );
};
