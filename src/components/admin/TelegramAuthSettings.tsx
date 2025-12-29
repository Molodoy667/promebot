import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Save, Eye, EyeOff } from "lucide-react";

const TelegramAuthSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadSettings();

    // Підписка на реал-тайм зміни
    const channel = supabase
      .channel('telegram_auth_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.telegram_login_widget',
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_login_widget")
        .single();

      if (!error && data) {
        const settings = data.value as any;
        setEnabled(settings.enabled || false);
        setBotUsername(settings.bot_username || "");
        setBotToken(settings.bot_token || "");
      }
    } catch (error) {
      console.error("Error loading Telegram login widget settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Check if settings exist
      const { data: existingData } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "telegram_login_widget")
        .single();

      if (existingData) {
        // Update existing settings
        const { error } = await supabase
          .from("app_settings")
          .update({
            value: {
              enabled,
              bot_username: botUsername,
              bot_token: botToken,
            },
          })
          .eq("key", "telegram_login_widget");

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "telegram_login_widget",
            value: {
              enabled,
              bot_username: botUsername,
              bot_token: botToken,
            },
          });

        if (error) throw error;
      }

      // Verify bot token with Telegram if enabled
      if (enabled && botToken) {
        try {
          const botInfoResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getMe`
          );
          const botInfo = await botInfoResponse.json();
          
          if (!botInfo.ok) {
            toast({
              title: "Попередження",
              description: "Налаштування збережені, але Bot Token може бути невірним. Перевірте його.",
              variant: "destructive",
              duration: 3000,
            });
          }
        } catch (verifyError) {
          console.error("Bot token verification error:", verifyError);
        }
      }

      toast({
        title: "Збережено!",
        description: "Налаштування Telegram Login Widget успішно оновлено",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося зберегти налаштування",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Telegram Login Widget</h3>
          <p className="text-sm text-muted-foreground">Офіційний віджет авторизації через Telegram</p>
        </div>
      </div>

      <Card className="p-6 glass-card space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="telegram-enabled" className="text-base font-medium text-foreground">
              Увімкнути Telegram Login Widget
            </Label>
            <p className="text-sm text-muted-foreground">
              Дозволити користувачам входити через офіційний Telegram віджет
            </p>
          </div>
          <Switch
            id="telegram-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-username" className="text-foreground font-medium">
            Username бота
          </Label>
          <Input
            id="bot-username"
            type="text"
            placeholder="@your_bot"
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value)}
            className="bg-background/60 border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Username вашого Telegram бота (з символом @)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bot-token" className="text-foreground font-medium">
            Bot Token
          </Label>
          <div className="relative">
            <Input
              id="bot-token"
              type={showToken ? "text" : "password"}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="bg-background/60 border-border/50 pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Токен отриманий від @BotFather
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={loading || !botUsername || !botToken}
          className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? "Збереження..." : "Зберегти налаштування"}
        </Button>

        {enabled && botUsername && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            <div>
              <p className="text-sm text-foreground mb-2">
                <strong>Інструкція для налаштування Login Widget:</strong>
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Відкрийте @BotFather в Telegram</li>
                <li>Створіть нового бота або використайте існуючого</li>
                <li>Скопіюйте Bot Token і вставте його вище</li>
                <li>Встановіть Domain для Login Widget командою: /setdomain</li>
                <li>Вкажіть ваш домен: {window.location.hostname}</li>
                <li>Збережіть налаштування</li>
              </ol>
            </div>
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                <strong>Примітка:</strong> Login Widget працює безпосередньо з Telegram API, без webhook'ів.
                Користувачі зможуть входити через кнопку "Login with Telegram" на сторінці авторизації.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TelegramAuthSettings;
