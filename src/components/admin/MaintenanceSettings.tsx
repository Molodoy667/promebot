import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Save, AlertTriangle } from "lucide-react";

export const MaintenanceSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    title: "Упс! Щось пішло не так",
    description: "Виникла непередбачена помилка. Спробуйте оновити сторінку.",
    allow_admins: true,
    allow_moderators: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();

      if (error) throw error;

      if (data?.value) {
        setSettings(data.value as any);
      }
    } catch (error) {
      console.error("Error loading maintenance settings:", error);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "maintenance_mode",
          value: settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Успішно збережено",
        description: "Налаштування тех. робіт оновлено",
      });
    } catch (error) {
      console.error("Error saving maintenance settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-warning" />
          <CardTitle>Технічні роботи</CardTitle>
        </div>
        <CardDescription>
          Налаштування режиму технічних робіт для сайту
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-warning/30 bg-warning/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <Label htmlFor="maintenance-enabled" className="text-base font-semibold">
                Увімкнути режим тех. робіт
              </Label>
              <p className="text-sm text-muted-foreground">
                Заблокує доступ до сайту для всіх користувачів
              </p>
            </div>
          </div>
          <Switch
            id="maintenance-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, enabled: checked })
            }
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="maintenance-title">Заголовок</Label>
          <Input
            id="maintenance-title"
            placeholder="Упс! Щось пішло не так"
            value={settings.title}
            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="maintenance-description">Опис</Label>
          <Textarea
            id="maintenance-description"
            placeholder="Виникла непередбачена помилка. Спробуйте оновити сторінку."
            value={settings.description}
            onChange={(e) =>
              setSettings({ ...settings, description: e.target.value })
            }
            rows={4}
          />
        </div>

        {/* Allow Admins */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <Label htmlFor="allow-admins" className="text-base">
              Дозволити адміністраторам
            </Label>
            <p className="text-sm text-muted-foreground">
              Адміни зможуть користуватись сайтом під час тех. робіт
            </p>
          </div>
          <Switch
            id="allow-admins"
            checked={settings.allow_admins}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, allow_admins: checked })
            }
          />
        </div>

        {/* Allow Moderators */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <Label htmlFor="allow-moderators" className="text-base">
              Дозволити модераторам
            </Label>
            <p className="text-sm text-muted-foreground">
              Модератори зможуть користуватись сайтом під час тех. робіт
            </p>
          </div>
          <Switch
            id="allow-moderators"
            checked={settings.allow_moderators}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, allow_moderators: checked })
            }
          />
        </div>

        {/* Save Button */}
        <Button onClick={saveSettings} disabled={isLoading} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Збереження..." : "Зберегти налаштування"}
        </Button>

        {settings.enabled && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Увага! Режим тех. робіт активний
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Користувачі не зможуть користуватись сайтом (крім адмінів/модерів якщо дозволено)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
