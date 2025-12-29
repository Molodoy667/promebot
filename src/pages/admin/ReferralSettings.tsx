import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReferralSettings {
  referrer_bonus: number;
  referee_bonus: number;
  min_withdrawal: number;
  max_withdrawal_per_day: number;
  tariff_commission_percent: number;
}

interface TariffPurchaseBonus {
  bonus_percent: number;
}

const ReferralSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [referrerBonus, setReferrerBonus] = useState("5");
  const [refereeBonus, setRefereeBonus] = useState("3");
  const [minWithdrawal, setMinWithdrawal] = useState("100");
  const [maxWithdrawalPerDay, setMaxWithdrawalPerDay] = useState("1000");
  const [tariffCommission, setTariffCommission] = useState("10");
  const [purchaseBonusPercent, setPurchaseBonusPercent] = useState("5");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Доступ заборонено",
          description: "У вас немає прав адміністратора",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setUser(session.user);
      await loadSettings();
      await loadPurchaseBonusSettings();
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPurchaseBonusSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tariff_purchase_bonus")
        .single();

      if (data) {
        const config = data.value as unknown as TariffPurchaseBonus;
        setPurchaseBonusPercent(config.bonus_percent.toString());
      }
    } catch (error) {
      console.error("Error loading purchase bonus settings:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "referral_config")
        .single();

      if (data && !error) {
        const config = data.value as unknown as ReferralSettings;
        setReferrerBonus((config?.referrer_bonus || 5).toString());
        setRefereeBonus((config?.referee_bonus || 3).toString());
        setMinWithdrawal((config?.min_withdrawal || 100).toString());
        setMaxWithdrawalPerDay((config?.max_withdrawal_per_day || 1000).toString());
        setTariffCommission((config?.tariff_commission_percent || 10).toString());
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const config: ReferralSettings = {
        referrer_bonus: parseFloat(referrerBonus) || 0,
        referee_bonus: parseFloat(refereeBonus) || 0,
        min_withdrawal: parseFloat(minWithdrawal) || 0,
        max_withdrawal_per_day: parseFloat(maxWithdrawalPerDay) || 0,
        tariff_commission_percent: parseFloat(tariffCommission) || 0,
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "referral_config")
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from("app_settings")
          .update({
            value: JSON.parse(JSON.stringify(config)),
            updated_at: new Date().toISOString(),
          })
          .eq("key", "referral_config");
        error = result.error;
      } else {
        const result = await supabase
          .from("app_settings")
          .insert([{
            key: "referral_config",
            value: JSON.parse(JSON.stringify(config)),
          }]);
        error = result.error;
      }

      if (error) throw error;

      // Save tariff purchase bonus
      const purchaseBonus: TariffPurchaseBonus = {
        bonus_percent: parseFloat(purchaseBonusPercent)
      };

      const { data: existingBonus } = await supabase
        .from("app_settings")
        .select("key")
        .eq("key", "tariff_purchase_bonus")
        .single();

      if (existingBonus) {
        const result = await supabase
          .from("app_settings")
          .update({
            value: JSON.parse(JSON.stringify(purchaseBonus)),
            updated_at: new Date().toISOString(),
          })
          .eq("key", "tariff_purchase_bonus");
        if (result.error) throw result.error;
      } else {
        const result = await supabase
          .from("app_settings")
          .insert([{
            key: "tariff_purchase_bonus",
            value: JSON.parse(JSON.stringify(purchaseBonus)),
          }]);
        if (result.error) throw result.error;
      }

      toast({
        title: "Успіх",
        description: "Налаштування реферальної програми збережено",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="container py-6 space-y-6">
      <PageBreadcrumbs />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Бонуси за рефералів</CardTitle>
            <CardDescription>Налаштуйте розміри винагород</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="referrerBonus">Бонус реферера (₴)</Label>
                <Input
                  id="referrerBonus"
                  type="text"
                  inputMode="decimal"
                  value={referrerBonus}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setReferrerBonus(value);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground">
                  Скільки отримує той, хто запросив
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="refereeBonus">Бонус рефералу (₴)</Label>
                <Input
                  id="refereeBonus"
                  type="text"
                  inputMode="decimal"
                  value={refereeBonus}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setRefereeBonus(value);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="3"
                />
                <p className="text-xs text-muted-foreground">
                  Скільки отримує запрошений користувач
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Приклад:</strong> Коли користувач A запрошує B через реферальне посилання:
                <br />• A отримує {referrerBonus}₴
                <br />• B отримує {refereeBonus}₴
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Комісія від тарифів</CardTitle>
            <CardDescription>Відсоток від купленого тарифу рефералом</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tariffCommission">Відсоток комісії (%)</Label>
              <Input
                id="tariffCommission"
                type="text"
                inputMode="decimal"
                value={tariffCommission}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setTariffCommission(value);
                  }
                }}
                onFocus={(e) => e.target.select()}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Відсоток від вартості тарифу, який отримує реферер при покупці
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseBonus">Бонус за покупку тарифу (%)</Label>
              <Input
                id="purchaseBonus"
                type="text"
                inputMode="decimal"
                value={purchaseBonusPercent}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setPurchaseBonusPercent(value);
                  }
                }}
                onFocus={(e) => e.target.select()}
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Відсоток від вартості тарифу, який користувач отримує на бонусний баланс після покупки
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Приклад:</strong> Якщо реферал купує тариф за 100₴ при комісії {tariffCommission}%:
                <br />• Реферер отримає {(100 * (parseFloat(tariffCommission || "0") || 0) / 100).toFixed(2)}₴ додатково
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Виведення коштів</CardTitle>
            <CardDescription>Ліміти для виведення реферальних коштів</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minWithdrawal">Мінімальна сума виведення (₴)</Label>
                <Input
                  id="minWithdrawal"
                  type="text"
                  inputMode="decimal"
                  value={minWithdrawal}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setMinWithdrawal(value);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Користувач зможе вивести тільки після накопичення цієї суми
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxWithdrawalPerDay">Максимум виведення на день (₴)</Label>
                <Input
                  id="maxWithdrawalPerDay"
                  type="text"
                  inputMode="decimal"
                  value={maxWithdrawalPerDay}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setMaxWithdrawalPerDay(value);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Денний ліміт для захисту від зловживань
                </p>
              </div>
            </div>
          </CardContent>
          <CardContent className="flex justify-end gap-2 border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Скасувати
            </Button>
            <Button onClick={saveSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Збереження..." : "Зберегти"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReferralSettingsPage;
