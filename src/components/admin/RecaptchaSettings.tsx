import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const RecaptchaSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  useEffect(() => {
    loadSettings();

    // Підписка на реал-тайм зміни
    const channel = supabase
      .channel('recaptcha_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.recaptcha',
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
        .eq("key", "recaptcha")
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const settings = data.value as any;
        setEnabled(settings.enabled || false);
        setSiteKey(settings.site_key || "");
        setSecretKey(settings.secret_key || "");
      }
    } catch (error: any) {
      console.error("Error loading reCAPTCHA settings:", error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({
          value: {
            enabled,
            site_key: siteKey,
            secret_key: secretKey,
          },
        })
        .eq("key", "recaptcha");

      if (error) throw error;

      toast({
        title: "Успішно збережено",
        description: "Налаштування reCAPTCHA оновлено",
        duration: 1500,
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося зберегти налаштування",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 glass-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Google reCAPTCHA</h3>
          <p className="text-sm text-muted-foreground">
            Захист від ботів при реєстрації та вході
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="recaptcha-enabled">Увімкнути reCAPTCHA</Label>
            <p className="text-sm text-muted-foreground">
              Активувати перевірку при вході та реєстрації
            </p>
          </div>
          <Switch
            id="recaptcha-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="site-key">Site Key</Label>
              <Input
                id="site-key"
                type="text"
                placeholder="6Lc..."
                value={siteKey}
                onChange={(e) => setSiteKey(e.target.value)}
                className="bg-background/60 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Публічний ключ reCAPTCHA (отримайте на{" "}
                <a
                  href="https://www.google.com/recaptcha/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  google.com/recaptcha
                </a>
                )
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret-key">Secret Key</Label>
              <Input
                id="secret-key"
                type="password"
                placeholder="6Lc..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="bg-background/60 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Приватний ключ reCAPTCHA (зберігається безпечно)
              </p>
            </div>
          </>
        )}

        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Збереження..." : "Зберегти налаштування"}
        </Button>
      </div>
    </Card>
  );
};