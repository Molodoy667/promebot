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
import { Save, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PrizesManagement } from "@/components/admin/PrizesManagement";

interface Prize {
  amount: number;
  probability: number;
  gradient: string;
}

interface RouletteSettings {
  spin_duration: number;
  cooldown_hours: number;
  prizes: Prize[];
}

const RouletteSettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [spinDuration, setSpinDuration] = useState("5000");
  const [cooldownHours, setCooldownHours] = useState("3");
  const [prizes, setPrizes] = useState<Prize[]>([
    { amount: 1, probability: 0.09524, gradient: "from-blue-300 to-blue-500" },
    { amount: 2, probability: 0.09048, gradient: "from-cyan-300 to-cyan-500" },
    { amount: 3, probability: 0.08571, gradient: "from-teal-300 to-teal-500" },
    { amount: 4, probability: 0.08095, gradient: "from-green-300 to-green-500" },
    { amount: 5, probability: 0.07619, gradient: "from-lime-300 to-lime-500" },
    { amount: 6, probability: 0.07143, gradient: "from-yellow-300 to-yellow-500" },
    { amount: 7, probability: 0.06667, gradient: "from-amber-300 to-amber-500" },
    { amount: 8, probability: 0.06190, gradient: "from-orange-300 to-orange-500" },
    { amount: 9, probability: 0.05714, gradient: "from-red-300 to-red-500" },
    { amount: 10, probability: 0.05238, gradient: "from-pink-300 to-pink-500" },
    { amount: 11, probability: 0.04762, gradient: "from-rose-300 to-rose-500" },
    { amount: 12, probability: 0.04286, gradient: "from-fuchsia-300 to-fuchsia-500" },
    { amount: 13, probability: 0.03810, gradient: "from-purple-300 to-purple-500" },
    { amount: 14, probability: 0.03333, gradient: "from-violet-300 to-violet-500" },
    { amount: 15, probability: 0.02857, gradient: "from-indigo-300 to-indigo-500" },
    { amount: 16, probability: 0.02381, gradient: "from-blue-400 to-blue-600" },
    { amount: 17, probability: 0.01905, gradient: "from-cyan-400 to-cyan-600" },
    { amount: 18, probability: 0.01429, gradient: "from-emerald-400 to-emerald-600" },
    { amount: 19, probability: 0.00952, gradient: "from-yellow-400 via-orange-500 to-red-600" },
    { amount: 20, probability: 0.00476, gradient: "from-purple-500 via-pink-500 to-red-500" },
  ]);
  const [selectedPrizeIndex, setSelectedPrizeIndex] = useState<number | null>(null);

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
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "roulette_config")
        .single();

      if (data && !error) {
        const config = data.value as unknown as RouletteSettings;
        setSpinDuration((config?.spin_duration || 5000).toString());
        setCooldownHours((config?.cooldown_hours || 3).toString());
        setPrizes(config?.prizes || []);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);
      
      if (Math.abs(totalProbability - 1) > 0.001) {
        toast({
          title: "Помилка",
          description: `Сума ймовірностей повинна дорівнювати 1 (зараз: ${totalProbability.toFixed(5)})`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const config: RouletteSettings = {
        spin_duration: parseInt(spinDuration) || 5000,
        cooldown_hours: parseFloat(cooldownHours) || 3,
        prizes: prizes.sort((a, b) => a.amount - b.amount),
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "roulette_config")
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from("app_settings")
          .update({
            value: JSON.parse(JSON.stringify(config)),
            updated_at: new Date().toISOString(),
          })
          .eq("key", "roulette_config");
        error = result.error;
      } else {
        const result = await supabase
          .from("app_settings")
          .insert([{
            key: "roulette_config",
            value: JSON.parse(JSON.stringify(config)),
          }]);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: "Успіх",
        description: "Налаштування рулетки збережено",
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

  const addPrize = () => {
    setPrizes([...prizes, { amount: 0, probability: 0, gradient: "from-gray-300 to-gray-500" }]);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  const updatePrize = (index: number, field: keyof Prize, value: any) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], [field]: value };
    setPrizes(updated);
  };

  if (isLoading) {
    return <Loading />;
  }

  const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);

  return (
    <div className="container py-6 space-y-6">
      <PageBreadcrumbs />

      {/* Prizes Management */}
      <PrizesManagement />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Загальні налаштування</CardTitle>
            <CardDescription>Час прокручування та кулдаун</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spinDuration">Час прокручування (мс)</Label>
              <Input
                id="spinDuration"
                type="text"
                value={spinDuration}
                onChange={(e) => setSpinDuration(e.target.value)}
                placeholder="5000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cooldownHours">Кулдаун між спінами (години)</Label>
              <Input
                id="cooldownHours"
                type="text"
                value={cooldownHours}
                onChange={(e) => setCooldownHours(e.target.value)}
                placeholder="3"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Призи та ймовірності</CardTitle>
                <CardDescription>
                  Клікніть на приз для редагування
                </CardDescription>
              </div>
              <Button onClick={addPrize} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Додати приз
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalProbability !== 0 && (
              <Alert className={Math.abs(totalProbability - 1) < 0.001 ? "" : "border-destructive"}>
                <AlertDescription>
                  Сума ймовірностей: <strong>{totalProbability.toFixed(5)}</strong>
                  {Math.abs(totalProbability - 1) < 0.001 ? " ✓" : " (повинна бути 1.00000)"}
                </AlertDescription>
              </Alert>
            )}

            {/* Prize Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {prizes.map((prize, index) => (
                <Button
                  key={index}
                  variant={selectedPrizeIndex === index ? "default" : "outline"}
                  className={`h-20 flex flex-col items-center justify-center gap-1 bg-gradient-to-r ${prize.gradient} text-white hover:opacity-80 border-2 ${selectedPrizeIndex === index ? 'border-primary ring-2 ring-primary' : 'border-white/50'}`}
                  onClick={() => setSelectedPrizeIndex(index)}
                >
                  <span className="text-2xl font-bold">{prize.amount}₴</span>
                  <span className="text-xs opacity-90">{(prize.probability * 100).toFixed(2)}%</span>
                </Button>
              ))}
            </div>

            {/* Selected Prize Editor */}
            {selectedPrizeIndex !== null && (
              <Card className="p-4 border-primary">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Редагування призу #{selectedPrizeIndex + 1}</h3>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      removePrize(selectedPrizeIndex);
                      setSelectedPrizeIndex(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Видалити
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Сума призу</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={prizes[selectedPrizeIndex].amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          updatePrize(selectedPrizeIndex, "amount", value === '' ? '' : parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updatePrize(selectedPrizeIndex, "amount", Math.max(0, value));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Ймовірність (0-1)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={prizes[selectedPrizeIndex].probability}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          updatePrize(selectedPrizeIndex, "probability", value === '' ? '' : parseFloat(value));
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updatePrize(selectedPrizeIndex, "probability", Math.max(0, Math.min(1, value)));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.05"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Градієнт (Tailwind)</Label>
                    <Input
                      type="text"
                      value={prizes[selectedPrizeIndex].gradient}
                      onChange={(e) => updatePrize(selectedPrizeIndex, "gradient", e.target.value)}
                      placeholder="from-blue-300 to-blue-500"
                    />
                  </div>
                </div>
                
                <div className={`mt-4 h-16 rounded bg-gradient-to-r ${prizes[selectedPrizeIndex].gradient} flex items-center justify-center text-white font-bold text-xl`}>
                  {prizes[selectedPrizeIndex].amount}₴ ({(prizes[selectedPrizeIndex].probability * 100).toFixed(3)}%)
                </div>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Скасувати
          </Button>
          <Button onClick={saveSettings} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Збереження..." : "Зберегти"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RouletteSettingsPage;
