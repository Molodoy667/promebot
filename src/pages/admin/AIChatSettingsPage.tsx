import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, DollarSign, Clock, Timer, Power } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

export default function AIChatSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    rental_price: "10",
    rental_duration_minutes: "60",
    free_duration_minutes: "10",
    free_cooldown_hours: "6",
    is_enabled: true,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_chat_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          rental_price: data.rental_price.toString(),
          rental_duration_minutes: data.rental_duration_minutes.toString(),
          free_duration_minutes: data.free_duration_minutes.toString(),
          free_cooldown_hours: data.free_cooldown_hours.toString(),
          is_enabled: data.is_enabled,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: settingsData } = await supabase
        .from("ai_chat_settings")
        .select("id")
        .single();

      if (!settingsData) throw new Error("Settings not found");

      const { error } = await supabase
        .from("ai_chat_settings")
        .update({
          rental_price: parseFloat(settings.rental_price) || 0,
          rental_duration_minutes: parseInt(settings.rental_duration_minutes) || 0,
          free_duration_minutes: parseInt(settings.free_duration_minutes) || 0,
          free_cooldown_hours: parseInt(settings.free_cooldown_hours) || 0,
          is_enabled: settings.is_enabled,
        })
        .eq("id", settingsData.id);

      if (error) throw error;

      toast({
        title: "Збережено",
        description: "Налаштування AI чату оновлено",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs />
      
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Налаштування AI Чату</h1>
          </div>
        </div>
        <p className="text-muted-foreground ml-13">
          Керуйте налаштуваннями AI чату для користувачів
        </p>
      </div>

      <div className="grid gap-6">
        {/* Status Card */}
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5 text-primary" />
              <CardTitle>Статус інструменту</CardTitle>
            </div>
            <CardDescription>
              Увімкніть або вимкніть AI чат для всіх користувачів
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-base">Увімкнути AI Чат</Label>
                <p className="text-sm text-muted-foreground">
                  Дозволити користувачам використовувати AI чат
                </p>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, is_enabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Card */}
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              <CardTitle>Ціноутворення</CardTitle>
            </div>
            <CardDescription>
              Налаштуйте вартість оренди AI чату
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rental_price" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Ціна оренди (бонусні ₴)
                </Label>
                <Input
                  id="rental_price"
                  type="text"
                  value={settings.rental_price}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      rental_price: e.target.value,
                    })
                  }
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Вартість оренди в бонусних коштах (списується з бонусного балансу)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rental_duration" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Тривалість оренди (хвилини)
                </Label>
                <Input
                  id="rental_duration"
                  type="text"
                  value={settings.rental_duration_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      rental_duration_minutes: e.target.value,
                    })
                  }
                  placeholder="60"
                />
                <p className="text-xs text-muted-foreground">
                  Скільки хвилин користувач отримає за оренду
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Access Card */}
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-warning" />
              <CardTitle>Безкоштовний доступ</CardTitle>
            </div>
            <CardDescription>
              Налаштуйте параметри безкоштовного використання
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="free_duration" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Безкоштовна тривалість (хвилини)
                </Label>
                <Input
                  id="free_duration"
                  type="text"
                  value={settings.free_duration_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      free_duration_minutes: e.target.value,
                    })
                  }
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Скільки хвилин безкоштовного доступу
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown" className="flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Кулдаун (години)
                </Label>
                <Input
                  id="cooldown"
                  type="text"
                  value={settings.free_cooldown_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      free_cooldown_hours: e.target.value,
                    })
                  }
                  placeholder="6"
                />
                <p className="text-xs text-muted-foreground">
                  Час очікування між безкоштовними сесіями
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Скасувати
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Зберегти зміни
          </Button>
        </div>
      </div>
    </div>
  );
}
