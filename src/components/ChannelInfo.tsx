import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, FileText, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChannelInfoProps {
  channelUsername: string;
  botToken: string;
  compact?: boolean;
  targetChannelType?: string;
}

interface TelegramChat {
  id: number;
  title: string;
  username?: string;
  photo?: {
    small_file_id: string;
    big_file_id: string;
  };
  members_count?: number;
}

export const ChannelInfo = ({ channelUsername, botToken, compact = false, targetChannelType }: ChannelInfoProps) => {
  const [channelInfo, setChannelInfo] = useState<TelegramChat | null>(null);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupergroup, setIsSupergroup] = useState(false);

  useEffect(() => {
    const fetchChannelInfo = async () => {
      setIsLoading(true);
      try {
        // Get channel info from Telegram
        const cleanUsername = channelUsername.startsWith('@') ? channelUsername.substring(1) : channelUsername;
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${cleanUsername}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch channel info");
        }

        const data = await response.json();
        
        if (data.ok) {
          setChannelInfo(data.result);
          
          // Перевірити тип чату (якщо це цільовий канал)
          if (targetChannelType === 'target' && data.result.type === 'supergroup') {
            setIsSupergroup(true);
          }
          
          // Get channel photo if available
          if (data.result.photo?.big_file_id) {
            const fileResponse = await fetch(
              `https://api.telegram.org/bot${botToken}/getFile?file_id=${data.result.photo.big_file_id}`
            );
            const fileData = await fileResponse.json();
            
            if (fileData.ok) {
              setPhotoUrl(
                `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
              );
            }
          }
        }

        // Get posts count from database
        // Використовуємо частковий збіг і шукаємо обидва статуси (success і published)
        const { count, error } = await supabase
          .from("posts_history")
          .select("*", { count: 'exact', head: true })
          .or(
            `source_channel.ilike.%${cleanUsername}%,target_channel.ilike.%${cleanUsername}%`
          )
          .in("status", ["published", "success"]);
        
        if (!error && typeof count === "number") {
          setPostsCount(count);
        }
      } catch (error) {
        console.error("Error fetching channel info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (channelUsername && botToken) {
      fetchChannelInfo();
    }
  }, [channelUsername, botToken]);

  if (isLoading) {
    return (
      <div className={compact ? "flex items-center gap-2 py-2" : "p-4 flex items-center justify-center"}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        {compact && <span className="text-sm text-muted-foreground">Завантаження...</span>}
      </div>
    );
  }

  if (!channelInfo) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 mt-2 rounded-lg bg-muted/30">
        <Avatar className="w-10 h-10">
          <AvatarImage src={photoUrl || undefined} alt={channelInfo.title} />
          <AvatarFallback className="text-sm font-semibold bg-gradient-primary text-white">
            {channelInfo.title.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{channelInfo.title}</h4>
          <p className="text-xs text-muted-foreground truncate">{channelUsername}</p>
          <div className="flex items-center gap-3 mt-1">
            {channelInfo.members_count !== undefined && channelInfo.members_count > 0 && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {channelInfo.members_count.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {postsCount} постів
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      {isSupergroup && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Увага:</strong> Цільовий канал є групою (supergroup). У групах Telegram 
            повідомлення завжди публікуються від імені бота, навіть якщо бот є анонімним адміністратором. 
            Щоб пости виглядали як від каналу, оберіть інший канал (не групу) як ціль.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16 border-2 border-primary/20 flex-shrink-0">
          <AvatarImage src={photoUrl || undefined} alt={channelInfo.title} />
          <AvatarFallback className="text-lg font-semibold bg-gradient-primary text-white">
            {channelInfo.title.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{channelInfo.title}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {channelUsername}
              </p>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 ml-2 flex-shrink-0">
              Підключено
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {channelInfo.members_count !== undefined && channelInfo.members_count > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Підписників</div>
                  <div className="font-semibold text-lg truncate">{channelInfo.members_count.toLocaleString()}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Тип каналу</div>
                <div className="font-semibold text-lg">
                  {channelInfo.username ? "Публічний" : "Приватний"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
