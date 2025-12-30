import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Loader2, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ChannelInfo } from "@/components/ChannelInfo";

interface SourceChannel {
  id: string;
  channel_username: string;
  is_active: boolean;
}

interface SourceChannelsManagerProps {
  serviceId: string;
  sourceChannels: SourceChannel[];
  botToken: string;
  sourcesLimit?: number;
  onChannelsUpdate: () => void;
}

export const SourceChannelsManager = ({
  serviceId,
  sourceChannels,
  botToken,
  sourcesLimit,
  onChannelsUpdate
}: SourceChannelsManagerProps) => {
  const { toast } = useToast();
  const [newChannelInput, setNewChannelInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleAddSourceChannel = async () => {
    const input = newChannelInput.trim();
    
    if (!input) {
      toast({
        title: "Помилка",
        description: "Вкажіть username або посилання на канал",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    if (sourcesLimit && sourceChannels.length >= sourcesLimit) {
      toast({
        title: "Ліміт досягнуто",
        description: `Ви досягли максимальної кількості джерел (${sourcesLimit})`,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsAdding(true);
    setIsVerifying(true);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Determine channel type and extract identifier
      let channelIdentifier = input;
      let isPrivate = false;
      let inviteHash = null;
      
      // Check if it's a private invite link
      if (input.includes('t.me/+') || input.includes('t.me/joinchat/')) {
        isPrivate = true;
        const match = input.match(/t\.me\/\+([A-Za-z0-9_-]+)/) || input.match(/t\.me\/joinchat\/([A-Za-z0-9_-]+)/);
        if (match) {
          inviteHash = match[1];
          channelIdentifier = `invite_${inviteHash}`;
        }
      } else {
        // Public channel - extract username
        if (input.includes('t.me/')) {
          const match = input.match(/t\.me\/([^/?]+)/);
          if (match) channelIdentifier = match[1];
        }
        channelIdentifier = channelIdentifier.replace('@', '');
      }

      // Verify channel via Edge Function
      toast({
        title: "Перевірка каналу...",
        description: "Зачекайте, йде підключення",
        duration: 2000,
      });

      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-source-channel", {
        body: {
          channelInput: input,
          channelIdentifier,
          isPrivate,
          inviteHash,
          botToken,
          serviceId
        }
      });

      if (verifyError || !verifyData?.success) {
        throw new Error(verifyData?.error || "Не вдалося перевірити канал");
      }

      // Add to database
      const { error } = await supabase
        .from("source_channels")
        .insert({
          bot_service_id: serviceId,
          channel_username: channelIdentifier,
          channel_title: verifyData.channelInfo?.title,
          is_private: isPrivate,
          invite_hash: inviteHash,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Успішно!",
        description: `Канал "${verifyData.channelInfo?.title || channelIdentifier}" додано`,
        duration: 3000,
      });

      setNewChannelInput("");
      onChannelsUpdate();
    } catch (error: any) {
      console.error("Error adding source channel:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося додати канал",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsAdding(false);
      setIsVerifying(false);
    }
  };

  const handleToggleChannelStatus = async (channelId: string, currentStatus: boolean) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { error } = await supabase
        .from("source_channels")
        .update({ is_active: !currentStatus })
        .eq("id", channelId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Канал деактивовано" : "Канал активовано",
        duration: 1500,
      });

      onChannelsUpdate();
    } catch (error: any) {
      console.error("Error toggling channel status:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося змінити статус каналу",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleDeleteSourceChannel = async (channelId: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { error } = await supabase
        .from("source_channels")
        .delete()
        .eq("id", channelId);

      if (error) throw error;

      toast({
        title: "Канал видалено",
        duration: 1500,
      });

      onChannelsUpdate();
    } catch (error: any) {
      console.error("Error deleting source channel:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити канал",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Канали-джерела</h2>
      
      {sourcesLimit && (
        <Alert className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Використано джерел: {sourceChannels.length} / {sourcesLimit}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channelInput">Username або посилання на канал</Label>
            <Input
              id="channelInput"
              placeholder="@channel, t.me/channel або t.me/+invite"
              value={newChannelInput}
              onChange={(e) => setNewChannelInput(e.target.value)}
              disabled={isAdding}
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                <strong>Публічний канал:</strong> @username або t.me/username
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Приватний канал:</strong> t.me/+invitehash (посилання-запрошення)
              </p>
            </div>
          </div>

          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <AlertDescription className="text-sm">
              <p className="font-medium mb-1">Як це працює:</p>
              <ul className="space-y-1 text-xs">
                <li>✓ Публічний канал - бот підключається автоматично</li>
                <li>✓ Приватний канал - використовується спамер з адмінки</li>
                <li>✓ Автоматична перевірка при додаванні</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleAddSourceChannel} 
            disabled={isAdding || isVerifying || (sourcesLimit !== undefined && sourceChannels.length >= sourcesLimit)}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Перевірка каналу...
              </>
            ) : isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Підключення...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Додати канал-джерело
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          {sourceChannels.map((channel) => (
            <Card key={channel.id} className="p-4 bg-background border-border">
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  {botToken ? (
                    <ChannelInfo 
                      channelUsername={channel.channel_username} 
                      botToken={botToken}
                      compact={true}
                    />
                  ) : (
                    <div className="flex-1">
                      <div className="font-medium">{channel.channel_username}</div>
                      <div className="text-sm text-muted-foreground">Канал-джерело</div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {channel.is_active ? "Активний" : "Неактивний"}
                    </span>
                    <Switch 
                      checked={channel.is_active} 
                      onCheckedChange={() => handleToggleChannelStatus(channel.id, channel.is_active)} 
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteSourceChannel(channel.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Видалити
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          
          {sourceChannels.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Поки що немає джерельних каналів</p>
              <p className="text-sm text-muted-foreground mt-1">Додайте канал вище, щоб почати</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
