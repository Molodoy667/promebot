import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Crown, Save } from "lucide-react";

export const VipSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    description: "",
    description_en: "",
    prices: {
      "3": 0,
      "7": 0,
      "14": 0,
      "30": 0,
    },
  });

  useEffect(() => {
    loadSettings();

    // Підписка на реал-тайм зміни
    const channel = supabase
      .channel('vip_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.vip_settings',
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
        .eq("key", "vip_settings")
        .single();

      if (error) throw error;

      if (data?.value) {
        setSettings(data.value as any);
      }
    } catch (error) {
      console.error("Error loading VIP settings:", error);
      toast({ title: "Помилка", description: "Помилка завантаження налаштувань", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({
          value: settings,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "vip_settings");

      if (error) throw error;

      toast({ title: "Успішно", description: "Налаштування VIP збережено" });
    } catch (error) {
      console.error("Error saving VIP settings:", error);
      toast({ title: "Помилка", description: "Помилка збереження налаштувань", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-600" />
          VIP Підписка
        </CardTitle>
        <CardDescription>
          Налаштування VIP підписки та цін
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Опис (UA)</Label>
          <Textarea
            id="description"
            value={settings.description}
            onChange={(e) =>
              setSettings({ ...settings, description: e.target.value })
            }
            placeholder="Опис VIP підписки українською..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description_en">Опис (EN)</Label>
          <Textarea
            id="description_en"
            value={settings.description_en}
            onChange={(e) =>
              setSettings({ ...settings, description_en: e.target.value })
            }
            placeholder="VIP subscription description in English..."
            rows={3}
          />
        </div>

        {/* Prices */}
        <div className="space-y-4">
          <Label>Ціни (грн)</Label>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(settings.prices).map(([days, price]) => (
              <div key={days} className="space-y-2">
                <Label htmlFor={`price-${days}`}>
                  {days} {days === "3" || days === "30" ? "днів" : "днів"}
                </Label>
                <Input
                  id={`price-${days}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={price === 0 ? '' : price.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setSettings({
                        ...settings,
                        prices: {
                          ...settings.prices,
                          [days]: value === '' ? 0 : parseFloat(value),
                        },
                      });
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Збереження..." : "Зберегти налаштування"}
        </Button>
      </CardContent>
    </Card>
  );
};


