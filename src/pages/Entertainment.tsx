import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouletteWheel } from "@/components/RouletteWheel";
import { LotteryBlock } from "@/components/LotteryBlock";
import { LotteryStats } from "@/components/LotteryStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, Ticket, Pickaxe, Target, Trophy, Joystick } from "lucide-react";
import MinerGame from "./MinerGame";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { ItchioGame } from "@/components/ItchioGame";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

export default function Entertainment() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast({
          title: "Помилка",
          description: "Потрібно увійти в систему",
          variant: "destructive",
        });
        return;
      }

      setUser(currentUser);

      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", currentUser.id)
        .single();

      if (profile) {
        setBonusBalance(profile.bonus_balance || 0);
      }

      // Load free spins
      const { data: freeSpinsData } = await supabase
        .from("free_spins")
        .select("spins_count")
        .eq("user_id", currentUser.id)
        .single();

      if (freeSpinsData) {
        setFreeSpins(freeSpinsData.spins_count || 0);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceUpdate = () => {
    loadUserData();
  };

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Увійдіть в систему, щоб отримати доступ до розваг
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageBreadcrumbs />
      <PageHeader
        icon={Gamepad2}
        title="Розваги"
        description="Рулетка, лотерея, майнер боти та ігри - випробуй свою удачу та заробляй бонуси!"
      >
        <BonusBalanceDisplay amount={bonusBalance} />
      </PageHeader>

      <Tabs defaultValue="roulette" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roulette" className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Рулетка
          </TabsTrigger>
          <TabsTrigger value="lottery" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Лотерея
          </TabsTrigger>
          <TabsTrigger value="games" className="flex items-center gap-2">
            <Joystick className="w-4 h-4" />
            Ігри
          </TabsTrigger>
          <TabsTrigger value="miner" className="flex items-center gap-2">
            <Pickaxe className="w-4 h-4" />
            Майнер Боти
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roulette" className="mt-6">
          <RouletteWheel
            user={user}
            onBalanceUpdate={handleBalanceUpdate}
            currentBalance={bonusBalance}
            freeSpins={freeSpins}
          />
        </TabsContent>

        <TabsContent value="lottery" className="mt-6 space-y-6">
          <LotteryBlock userId={user.id} userBalance={bonusBalance} />
          <LotteryStats />
        </TabsContent>

        <TabsContent value="games" className="mt-6">
          <ItchioGame 
            userId={user.id} 
            currentBalance={bonusBalance}
            onBalanceUpdate={handleBalanceUpdate}
          />
        </TabsContent>

        <TabsContent value="miner" className="mt-6">
          <MinerGame />
        </TabsContent>
      </Tabs>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold mb-1">Рулетка удачі</h3>
            <p className="text-xs text-muted-foreground">
              Крути колесо та виграй до <BonusBalanceDisplay amount={100} iconSize={12} showIcon={false} />
            </p>
            <p className="text-xs text-primary mt-1">VIP: подвійні призи!</p>
          </CardContent>
        </Card>
        
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4 text-center">
            <Ticket className="w-8 h-8 mx-auto mb-2 text-warning" />
            <h3 className="font-semibold mb-1">Лотерея</h3>
            <p className="text-xs text-muted-foreground">
              Купуй квитки та виграй джекпот!
            </p>
            <p className="text-xs text-warning mt-1">Розіграші щогодини</p>
          </CardContent>
        </Card>
        
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 text-center">
            <Pickaxe className="w-8 h-8 mx-auto mb-2 text-success" />
            <h3 className="font-semibold mb-1">Майнер Боти</h3>
            <p className="text-xs text-muted-foreground">
              Купуй майнери та заробляй автоматично!
            </p>
            <p className="text-xs text-success mt-1">Пасивний дохід 24/7</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
