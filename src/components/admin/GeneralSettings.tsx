import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Save, Loader2, Globe, Image as ImageIcon, FileText, BarChart3, Mail, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const GeneralSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [aiToolEnabled, setAiToolEnabled] = useState(false);
  const [aiPostToolEnabled, setAiPostToolEnabled] = useState(false);
  const [aiPricing, setAiPricing] = useState({ imagePrice: 5, postTextPrice: 5, postImagePrice: 2 });
  const [notificationsSoundEnabled, setNotificationsSoundEnabled] = useState(true);
  
  const [settings, setSettings] = useState({
    site_name: "",
    site_description: "",
    meta_keywords: "",
    favicon_url: "",
    logo_url: "",
    maintenance_mode: false,
    email_confirmation_required: true,
  });

  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    loadSettings();
    loadAnalytics();
    loadAiToolStatus();
    loadAiPricing();
    loadNotificationsSoundSetting();

    // Підписка на реал-тайм зміни налаштувань
    const channel = supabase
      .channel('general_settings_all_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
        },
        () => {
          loadSettings();
          loadAiToolStatus();
          loadAiPricing();
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
        .select("*")
        .eq("key", "general_settings")
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const loadedSettings = data.value as any;
        setSettings({
          site_name: loadedSettings.site_name || "",
          site_description: loadedSettings.site_description || "",
          meta_keywords: loadedSettings.meta_keywords || "",
          favicon_url: loadedSettings.favicon_url || "",
          logo_url: loadedSettings.logo_url || "",
          maintenance_mode: loadedSettings.maintenance_mode || false,
          email_confirmation_required: loadedSettings.email_confirmation_required !== false,
        });
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from("site_analytics")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

      if (error) throw error;
      setAnalytics(data || []);
    } catch (error: any) {
      console.error("Error loading analytics:", error);
    }
  };

  const loadAiToolStatus = async () => {
    try {
      const { data: imageData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_image_tool_enabled")
        .single();

      if (imageData) {
        setAiToolEnabled(imageData.value as boolean);
      }
      
      const { data: postData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_post_tool_enabled")
        .single();

      if (postData) {
        setAiPostToolEnabled(postData.value as boolean);
      }
    } catch (error: any) {
      console.error("Error loading AI tool status:", error);
    }
  };

  const loadAiPricing = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_pricing")
        .single();

      if (data?.value) {
        const pricing = data.value as any;
        setAiPricing({
          imagePrice: pricing.imagePrice ?? 5,
          postTextPrice: pricing.postTextPrice ?? 5,
          postImagePrice: pricing.postImagePrice ?? 2,
        });
      }
    } catch (error: any) {
      console.error("Error loading AI pricing:", error);
    }
  };

  const loadNotificationsSoundSetting = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "notifications_sound_enabled")
        .single();

      if (data?.value !== undefined) {
        setNotificationsSoundEnabled(data.value === true || data.value === 'true');
      }
    } catch (error: any) {
      console.error("Error loading notifications sound setting:", error);
    }
  };

  const toggleAiTool = async (enabled: boolean) => {
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_image_tool_enabled")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: enabled })
          .eq("key", "ai_image_tool_enabled");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "ai_image_tool_enabled",
            value: enabled,
          });

        if (error) throw error;
      }

      setAiToolEnabled(enabled);

      toast({
        title: enabled ? "Інструмент увімкнено" : "Інструмент вимкнено",
        description: enabled 
          ? "AI генерація зображень тепер доступна користувачам"
          : "AI генерація зображень тимчасово вимкнена",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const toggleNotificationsSound = async (enabled: boolean) => {
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "notifications_sound_enabled")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: enabled })
          .eq("key", "notifications_sound_enabled");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "notifications_sound_enabled",
            value: enabled,
          });

        if (error) throw error;
      }

      setNotificationsSoundEnabled(enabled);

      toast({
        title: enabled ? "Звук увімкнено" : "Звук вимкнено",
        description: enabled 
          ? "Користувачі отримуватимуть звукові сповіщення"
          : "Звукові сповіщення вимкнено для всіх користувачів",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const toggleAiPostTool = async (enabled: boolean) => {
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_post_tool_enabled")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: enabled })
          .eq("key", "ai_post_tool_enabled");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "ai_post_tool_enabled",
            value: enabled,
          });

        if (error) throw error;
      }

      setAiPostToolEnabled(enabled);

      toast({
        title: enabled ? "Інструмент увімкнено" : "Інструмент вимкнено",
        description: enabled 
          ? "AI генерація постів тепер доступна користувачам"
          : "AI генерація постів тимчасово вимкнена",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const saveAiPricing = async () => {
    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_pricing")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: aiPricing })
          .eq("key", "ai_pricing");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "ai_pricing",
            value: aiPricing,
          });

        if (error) throw error;
      }

      toast({
        title: "Збережено",
        description: "Ціни на AI інструменти оновлено",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let faviconUrl = settings.favicon_url;
      let logoUrl = settings.logo_url;

      // Upload favicon if new file selected
      if (faviconFile) {
        faviconUrl = await uploadFile(faviconFile, 'avatars', 'favicons');
      }

      // Upload logo if new file selected
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, 'avatars', 'logos');
      }

      const updatedSettings = {
        ...settings,
        favicon_url: faviconUrl,
        logo_url: logoUrl,
      };

      // Check if settings exist
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "general_settings")
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("app_settings")
          .update({ value: updatedSettings })
          .eq("key", "general_settings");

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("app_settings")
          .insert({
            key: "general_settings",
            value: updatedSettings,
          });

        if (error) throw error;
      }

      setSettings(updatedSettings);
      setFaviconFile(null);
      setLogoFile(null);

      toast({
        title: "Налаштування збережено",
        description: "Генеральні налаштування успішно оновлено",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalVisits = analytics.reduce((sum, day) => sum + (day.visits || 0), 0);
  const totalPageViews = analytics.reduce((sum, day) => sum + (day.page_views || 0), 0);
  const totalUniqueVisitors = analytics.reduce((sum, day) => sum + (day.unique_visitors || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle>Основні налаштування</CardTitle>
          </div>
          <CardDescription>
            Налаштування сайту та метаданих
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site_name">Назва сайту</Label>
            <Input
              id="site_name"
              value={settings.site_name}
              onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
              placeholder="PromoBot"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site_description">Опис сайту (meta description)</Label>
            <Textarea
              id="site_description"
              value={settings.site_description}
              onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
              placeholder="Автоматизація Telegram каналів"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_keywords">Ключові слова (meta keywords)</Label>
            <Input
              id="meta_keywords"
              value={settings.meta_keywords}
              onChange={(e) => setSettings({ ...settings, meta_keywords: e.target.value })}
              placeholder="telegram, bot, automation"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            <CardTitle>Логотип та Фавікон</CardTitle>
          </div>
          <CardDescription>
            Завантажте зображення для сайту
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="favicon">Фавікон</Label>
            <div className="flex items-center gap-4">
              {settings.favicon_url && (
                <img 
                  src={settings.favicon_url} 
                  alt="Favicon" 
                  className="w-8 h-8 rounded border"
                />
              )}
              <Input
                id="favicon"
                type="file"
                accept="image/*"
                onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Рекомендовано: 32x32px або 64x64px, PNG або ICO
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Логотип</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url && (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  className="h-12 rounded border"
                />
              )}
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Рекомендовано: прозорий фон, PNG формат
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle>Режим технічних робіт</CardTitle>
          </div>
          <CardDescription>
            Тимчасово закрити сайт для користувачів
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="maintenance_mode" className="text-base font-semibold">
                Режим технічних робіт
              </Label>
              <p className="text-sm text-muted-foreground">
                Користувачі побачать повідомлення про технічне обслуговування
              </p>
            </div>
            <Switch
              id="maintenance_mode"
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, maintenance_mode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>AI Інструменти</CardTitle>
          </div>
          <CardDescription>
            Налаштування штучного інтелекту для генерації контенту
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ai_tool" className="text-base font-semibold">
                Генерація зображень AI
              </Label>
              <p className="text-sm text-muted-foreground">
                Дозволити користувачам генерувати зображення за допомогою штучного інтелекту (5₴ за спробу)
              </p>
            </div>
            <Switch
              id="ai_tool"
              checked={aiToolEnabled}
              onCheckedChange={toggleAiTool}
            />
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <Label htmlFor="ai_post_tool" className="text-base font-semibold">
                Генерація постів AI
              </Label>
              <p className="text-sm text-muted-foreground">
                Дозволити користувачам генерувати пости для Telegram за допомогою штучного інтелекту
              </p>
            </div>
            <Switch
              id="ai_post_tool"
              checked={aiPostToolEnabled}
              onCheckedChange={toggleAiPostTool}
            />
          </div>

          <div className="pt-4 border-t space-y-4">
            <div>
              <Label className="text-base font-semibold">Ціни на AI інструменти (₴)</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Встановіть ціни які будуть стягуватись з бонусного балансу користувачів
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="image_price">Генерація зображення</Label>
                <Input
                  id="image_price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={aiPricing.imagePrice === 0 ? '' : (aiPricing.imagePrice ?? '').toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAiPricing({ ...aiPricing, imagePrice: value === '' ? 0 : parseFloat(value) });
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post_text_price">Генерація тексту посту</Label>
                <Input
                  id="post_text_price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={aiPricing.postTextPrice === 0 ? '' : (aiPricing.postTextPrice ?? '').toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAiPricing({ ...aiPricing, postTextPrice: value === '' ? 0 : parseFloat(value) });
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post_image_price">Зображення для посту (додатково)</Label>
                <Input
                  id="post_image_price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={aiPricing.postImagePrice === 0 ? '' : (aiPricing.postImagePrice ?? '').toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setAiPricing({ ...aiPricing, postImagePrice: value === '' ? 0 : parseFloat(value) });
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>

            <Button onClick={saveAiPricing} className="w-full md:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Зберегти ціни
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle>Підтвердження Email</CardTitle>
          </div>
          <CardDescription>
            Налаштування підтвердження електронної пошти при реєстрації
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="email_confirmation" className="text-base font-semibold">
                Вимагати підтвердження email
              </Label>
              <p className="text-sm text-muted-foreground">
                Користувачі повинні підтвердити email перед входом в систему
              </p>
            </div>
            <Switch
              id="email_confirmation"
              checked={settings.email_confirmation_required}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, email_confirmation_required: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notifications_sound" className="text-base font-semibold">
                Звук сповіщень
              </Label>
              <p className="text-sm text-muted-foreground">
                Увімкнути звукові сповіщення для користувачів
              </p>
            </div>
            <Switch
              id="notifications_sound"
              checked={notificationsSoundEnabled}
              onCheckedChange={toggleNotificationsSound}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle>Статистика сайту</CardTitle>
          </div>
          <CardDescription>
            Загальна статистика відвідувань за останні 30 днів
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm text-muted-foreground">Візити</p>
              <p className="text-2xl font-bold text-primary">{totalVisits.toLocaleString()}</p>
            </div>
            <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm text-muted-foreground">Унікальні відвідувачі</p>
              <p className="text-2xl font-bold text-primary">{totalUniqueVisitors.toLocaleString()}</p>
            </div>
            <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm text-muted-foreground">Переглядів сторінок</p>
              <p className="text-2xl font-bold text-primary">{totalPageViews.toLocaleString()}</p>
            </div>
          </div>

          {analytics.length > 0 ? (
            <div className="space-y-2">
              <Label>Останні дні</Label>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted/50 font-semibold text-sm sticky top-0">
                  <div>Дата</div>
                  <div>Візити</div>
                  <div>Унікальні</div>
                  <div>Перегляди</div>
                </div>
                {analytics.slice(0, 10).map((day) => (
                  <div key={day.id} className="grid grid-cols-4 gap-2 p-2 border-t text-sm">
                    <div>{new Date(day.date).toLocaleDateString('uk-UA')}</div>
                    <div>{day.visits}</div>
                    <div>{day.unique_visitors}</div>
                    <div>{day.page_views}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Немає даних статистики
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-primary hover:opacity-90 transition-smooth"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Збереження...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Зберегти налаштування
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
