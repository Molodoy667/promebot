import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LotteryStats } from "@/components/LotteryStats";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { Settings, Play, Pause, RefreshCw, DollarSign, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LotterySettings {
  id: string;
  ticket_price: number;
  draw_interval_hours: number;
  double_prize_threshold: number;
  is_enabled: boolean;
}

interface ActiveRound {
  id: string;
  prize_pool: number;
  participants_count: number;
  start_time: string;
}

export default function LotteryPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LotterySettings | null>(null);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const showToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    const toastDiv = document.createElement('div');
    toastDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(toastDiv);
    
    toast({
      title,
      description: (
        <div className="flex items-center gap-2">
          <span className="flex-1">{description}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(`${title}\n${description}`);
              toast({ title: "✅ Скопійовано" });
            }}
          >
            📋
          </Button>
        </div>
      ),
      variant,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("lottery_settings")
        .select("*")
        .limit(1)
        .single();

      if (settingsError) throw settingsError;
      setSettings(settingsData);

      // Fetch active round
      const { data: roundData } = await supabase
        .from("lottery_rounds")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveRound(roundData);
    } catch (error: any) {
      console.error("Помилка завантаження даних:", error);
      showToast("Помилка", error.message, "destructive");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("lottery_settings")
        .update({
          ticket_price: settings.ticket_price,
          draw_interval_hours: settings.draw_interval_hours,
          double_prize_threshold: settings.double_prize_threshold,
          is_enabled: settings.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (error) throw error;

      showToast("✅ Збережено", "Налаштування лотереї оновлено");

      fetchData();
    } catch (error: any) {
      console.error("Помилка збереження налаштувань:", error);
      showToast("Помилка", error.message, "destructive");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualDraw = async () => {
    if (!activeRound) return;

    setIsDrawing(true);
    try {
      const { data, error } = await supabase.rpc("draw_lottery_winner", {
        p_round_id: activeRound.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; winner_id?: string; prize?: number };

      if (result.success) {
        showToast("Розіграш проведено!", `Переможець отримав ${result.prize?.toFixed(2)}₴`);
        fetchData();
      } else {
        showToast("Помилка", result.error || "Не вдалося провести розіграш", "destructive");
      }
    } catch (error: any) {
      console.error("Помилка розіграшу:", error);
      showToast("Помилка", error.message, "destructive");
    } finally {
      setIsDrawing(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <PageBreadcrumbs />
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Налаштування лотереї не знайдено
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageBreadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Управління лотереєю</h1>
          <p className="text-muted-foreground">
            Налаштування, статистика та управління розіграшами
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="icon">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Налаштування
            </CardTitle>
            <CardDescription>
              Основні параметри лотереї
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base">Статус лотереї</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.is_enabled ? "Лотерея активна" : "Лотерея вимкнена"}
                </p>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, is_enabled: checked })
                }
              />
            </div>

            {/* Ticket Price */}
            <div className="space-y-2">
              <Label htmlFor="ticket_price" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Ціна квитка (₴)
              </Label>
              <Input
                id="ticket_price"
                type="text"
                value={settings.ticket_price}
                onChange={(e) =>
                  setSettings({ ...settings, ticket_price: parseFloat(e.target.value) || 0 })
                }
                placeholder="10"
              />
            </div>

            {/* Draw Interval */}
            <div className="space-y-2">
              <Label htmlFor="draw_interval" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Інтервал розіграшу (годин)
              </Label>
              <Input
                id="draw_interval"
                type="text"
                value={settings.draw_interval_hours}
                onChange={(e) =>
                  setSettings({ ...settings, draw_interval_hours: parseInt(e.target.value) || 0 })
                }
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground">
                Розіграш проводитиметься кожні {settings.draw_interval_hours} годин(и)
              </p>
            </div>

            {/* Double Prize Threshold */}
            <div className="space-y-2">
              <Label htmlFor="double_threshold">
                Поріг подвоєння призу (учасників)
              </Label>
              <Input
                id="double_threshold"
                type="text"
                value={settings.double_prize_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, double_prize_threshold: parseInt(e.target.value) || 0 })
                }
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Приз подвоюється, якщо учасників ≤ {settings.double_prize_threshold}
              </p>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? "Збереження..." : "Зберегти налаштування"}
            </Button>
          </CardContent>
        </Card>

        {/* Active Round Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Поточний раунд
            </CardTitle>
            <CardDescription>
              Інформація про поточний розіграш
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRound ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <span className="text-sm text-muted-foreground">Призовий фонд</span>
                    <span className="text-2xl font-bold text-green-500">
                      {activeRound.prize_pool.toFixed(2)}₴
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <span className="text-sm text-muted-foreground">Учасників</span>
                    <span className="text-2xl font-bold text-blue-500">
                      {activeRound.participants_count}
                    </span>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Початок раунду</p>
                    <p className="font-semibold">
                      {new Date(activeRound.start_time).toLocaleString("uk-UA")}
                    </p>
                  </div>

                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <p className="text-sm text-muted-foreground mb-1">Потенційний приз</p>
                    <p className="text-xl font-bold text-yellow-500">
                      {activeRound.participants_count <= settings.double_prize_threshold
                        ? (activeRound.prize_pool * 2).toFixed(2)
                        : activeRound.prize_pool.toFixed(2)}₴
                    </p>
                    {activeRound.participants_count <= settings.double_prize_threshold && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Подвоєний приз!
                      </p>
                    )}
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isDrawing || activeRound.participants_count === 0}
                    >
                      {isDrawing ? "Проведення..." : "Провести розіграш зараз"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Провести розіграш?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Буде обрано випадкового переможця з {activeRound.participants_count}{" "}
                        учасник(ів). Приз складе{" "}
                        {activeRound.participants_count <= settings.double_prize_threshold
                          ? (activeRound.prize_pool * 2).toFixed(2)
                          : activeRound.prize_pool.toFixed(2)}₴.
                        <br />
                        <br />
                        Цю дію неможливо скасувати.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Скасувати</AlertDialogCancel>
                      <AlertDialogAction onClick={handleManualDraw}>
                        Провести
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {activeRound.participants_count === 0 && (
                  <p className="text-sm text-center text-muted-foreground">
                    Немає учасників для розіграшу
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Немає активного раунду
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <LotteryStats />
    </div>
  );
}
