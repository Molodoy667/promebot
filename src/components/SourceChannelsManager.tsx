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
  const [newChannelUsername, setNewChannelUsername] = useState("");
  const [newChannelType, setNewChannelType] = useState<"public" | "private">("public");
  const [inviteLink, setInviteLink] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddSourceChannel = async () => {
    if (!newChannelUsername.trim()) {
      toast({
        title: "Помилка",
        description: "Вкажіть username каналу",
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
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      let channelToAdd = newChannelUsername.trim();
      if (channelToAdd.includes('t.me/')) {
        const match = channelToAdd.match(/t\.me\/([^/?]+)/);
        if (match) channelToAdd = match[1];
      }
      channelToAdd = channelToAdd.replace('@', '');

      const { error } = await supabase
        .from("source_channels")
        .insert({
          bot_service_id: serviceId,
          channel_username: channelToAdd,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Канал-джерело додано",
        duration: 2000,
      });

      setNewChannelUsername("");
      setInviteLink("");
      onChannelsUpdate();
    } catch (error: any) {
      console.error("Error adding source channel:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося додати канал",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsAdding(false);
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
            <Label>Тип каналу</Label>
            <RadioGroup value={newChannelType} onValueChange={(value: "public" | "private") => setNewChannelType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="cursor-pointer">Публічний канал</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="cursor-pointer">Приватний канал</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channelUsername">
              {newChannelType === "public" ? "Username каналу" : "Chat ID приватного каналу"}
            </Label>
            <Input
              id="channelUsername"
              placeholder={newChannelType === "public" ? "@channel або t.me/channel" : "-1001234567890"}
              value={newChannelUsername}
              onChange={(e) => setNewChannelUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {newChannelType === "public" 
                ? "Вкажіть @username або посилання t.me/username" 
                : "Отримайте chat_id через @userinfobot"}
            </p>
          </div>

          {newChannelType === "private" && (
            <div className="space-y-2">
              <Label htmlFor="inviteLink">Посилання-запрошення (опціонально)</Label>
              <Input
                id="inviteLink"
                placeholder="https://t.me/+xxxxx"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Для автоматичного підписування бота (якщо потрібно)
              </p>
            </div>
          )}

          <Button 
            onClick={handleAddSourceChannel} 
            disabled={isAdding || (sourcesLimit !== undefined && sourceChannels.length >= sourcesLimit)}
            className="w-full"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Додавання...
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
