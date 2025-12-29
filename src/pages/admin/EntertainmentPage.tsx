import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Ticket, Pickaxe } from "lucide-react";
import RouletteSettings from "./RouletteSettings";
import LotteryPage from "./LotteryPage";
import PrizesPage from "./PrizesPage";
import { MinerSettings } from "@/components/admin/MinerSettings";

export default function EntertainmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Налаштування Розваг</h1>
        <p className="text-muted-foreground">
          Керуйте рулеткою, лотереєю та призами
        </p>
      </div>

      <Tabs defaultValue="roulette" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roulette" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Рулетка
          </TabsTrigger>
          <TabsTrigger value="lottery" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Лотерея & Призи
          </TabsTrigger>
          <TabsTrigger value="miner" className="flex items-center gap-2">
            <Pickaxe className="w-4 h-4" />
            Майнер Боти
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roulette" className="mt-6">
          <RouletteSettings />
        </TabsContent>

        <TabsContent value="lottery" className="mt-6">
          <LotteryPage />
        </TabsContent>

        <TabsContent value="miner" className="mt-6">
          <MinerSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
