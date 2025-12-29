import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, MessageSquare, LogIn, ClipboardCheck, Info, Volume2, Bot } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NotificationSettingsData {
  ticket_reply_enabled: boolean;
  account_login_enabled: boolean;
  task_moderation_enabled: boolean;
  system_notifications_enabled: boolean;
  bot_status_enabled: boolean;
}

export const NotificationSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettingsData>({
    ticket_reply_enabled: true,
    account_login_enabled: true,
    task_moderation_enabled: true,
    system_notifications_enabled: true,
    bot_status_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
    loadSoundSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ticket_reply_enabled: data.ticket_reply_enabled,
          account_login_enabled: data.account_login_enabled,
          task_moderation_enabled: data.task_moderation_enabled,
          system_notifications_enabled: data.system_notifications_enabled,
          bot_status_enabled: data.bot_status_enabled ?? true,
        });
      }
    } catch (error: any) {
      console.error("Error loading notification settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування сповіщень",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSoundSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'notifications_sound_enabled')
        .single();
      
      if (data?.value !== undefined) {
        setSoundEnabled(data.value === true || data.value === 'true');
      }
    } catch (error: any) {
      console.error("Error loading sound settings:", error);
    }
  };

  const updateSoundSetting = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: enabled })
        .eq('key', 'notifications_sound_enabled');

      if (error) throw error;

      setSoundEnabled(enabled);

      toast({
        title: "Успішно",
        description: `Звук сповіщень ${enabled ? 'увімкнено' : 'вимкнено'}`,
      });
    } catch (error: any) {
      console.error("Error updating sound settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити налаштування звуку",
        variant: "destructive",
      });
    }
  };

  const updateSetting = async (key: keyof NotificationSettingsData, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));

      toast({
        title: "Успішно",
        description: "Налаштування сповіщень оновлено",
      });
    } catch (error: any) {
      console.error("Error updating notification settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити налаштування",
        variant: "destructive",
      });
    }
  };

  const settingsItems = [
    {
      key: "ticket_reply_enabled" as keyof NotificationSettingsData,
      icon: MessageSquare,
      title: "Відповіді на тікети",
      description: "Отримувати сповіщення про відповіді адміністрації на ваші звернення",
    },
    {
      key: "account_login_enabled" as keyof NotificationSettingsData,
      icon: LogIn,
      title: "Вхід в акаунт",
      description: "Отримувати сповіщення про вхід в ваш акаунт",
    },
    {
      key: "task_moderation_enabled" as keyof NotificationSettingsData,
      icon: ClipboardCheck,
      title: "Модерація завдань",
      description: "Отримувати сповіщення про схвалення або відхилення завдань",
    },
    {
      key: "bot_status_enabled" as keyof NotificationSettingsData,
      icon: Bot,
      title: "Сповіщення бота",
      description: "Отримувати сповіщення про запуск/зупинку та помилки ботів",
    },
    {
      key: "system_notifications_enabled" as keyof NotificationSettingsData,
      icon: Info,
      title: "Системні сповіщення",
      description: "Отримувати важливі системні повідомлення та оновлення",
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Налаштування сповіщень
          </CardTitle>
          <CardDescription>Завантаження...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Налаштування сповіщень
        </CardTitle>
        <CardDescription>
          Налаштуйте, які сповіщення ви хочете отримувати
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Volume2 className="w-5 h-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <Label htmlFor="sound-enabled" className="text-base cursor-pointer">
                  Звук сповіщень
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Відтворювати звук при отриманні нових сповіщень
                </p>
              </div>
            </div>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={updateSoundSetting}
            />
          </div>
          <Separator className="mt-6" />
        </div>
        {settingsItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.key}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="w-5 h-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor={item.key} className="text-base cursor-pointer">
                      {item.title}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={item.key}
                  checked={settings[item.key]}
                  onCheckedChange={(checked) => updateSetting(item.key, checked)}
                />
              </div>
              {index < settingsItems.length - 1 && <Separator className="mt-6" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
