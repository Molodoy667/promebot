import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Zap, Coins, Bot, Settings as SettingsIcon, Plus, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface MinerBot {
  id: string;
  type: string;
  name: string;
  description: string;
  earnings_per_hour: number;
  cost: number;
  max_level: number;
  image: string;
  image_url?: string; // URL для завантаженого зображення
}

interface MinerUpgrade {
  id: string;
  name: string;
  description: string;
  type: 'energy' | 'mining' | 'auto_collect' | 'earnings';
  levels: {
    level: number;
    cost: number;
    effect: number; // множник або значення
  }[];
  max_level: number;
  icon: string;
}

interface MinerSettings {
  // Energy settings
  max_energy: number;
  energy_per_tap: number;
  energy_regen_rate: number; // energy per second
  energy_regen_interval: number; // seconds
  
  // Mining settings
  base_mining_power: number;
  mining_multiplier: number;
  max_claim_hours: number; // max hours to accumulate earnings
  
  // Storage upgrade settings
  storage_base_hours: number; // базова кількість годин (рівень 1)
  storage_hours_per_level: number; // +годин за кожен рівень
  storage_base_cost: number; // базова ціна покращення
  storage_cost_multiplier: number; // множник ціни за рівень
  
  // Auto-collect settings
  auto_collect_enabled_default: boolean;
  auto_collect_interval: number; // minutes
  auto_collect_energy_cost: number;
  
  // Upgrade settings
  bot_upgrade_cost_multiplier: number;
  bot_level_earning_multiplier: number;
  
  // Daily rewards
  daily_reward_base: number;
  daily_reward_streak_bonus: number;
  
  // Starting bonuses
  starting_coins: number;
  starting_energy: number;
  
  // Bots configuration
  bots: MinerBot[];
  
  // Upgrades configuration
  upgrades: MinerUpgrade[];
}

const DEFAULT_SETTINGS: MinerSettings = {
  max_energy: 1000,
  energy_per_tap: 1,
  energy_regen_rate: 1,
  energy_regen_interval: 10,
  base_mining_power: 1,
  mining_multiplier: 1,
  max_claim_hours: 6,
  storage_base_hours: 6,
  storage_hours_per_level: 2,
  storage_base_cost: 100,
  storage_cost_multiplier: 1.5,
  auto_collect_enabled_default: false,
  auto_collect_interval: 60,
  auto_collect_energy_cost: 50,
  bot_upgrade_cost_multiplier: 1.5,
  bot_level_earning_multiplier: 1.2,
  daily_reward_base: 100,
  daily_reward_streak_bonus: 50,
  starting_coins: 0,
  starting_energy: 1000,
  bots: [
    {
      id: "basic_miner",
      type: "basic",
      name: "Базовий Майнер",
      description: "Простий бот для початківців",
      earnings_per_hour: 5,
      cost: 150,
      max_level: 10,
      image: "bot"
    },
    {
      id: "turbo_miner",
      type: "turbo",
      name: "Турбо Майнер",
      description: "Швидкий бот з підвищеною продуктивністю",
      earnings_per_hour: 30,
      cost: 1200,
      max_level: 10,
      image: "zap"
    },
    {
      id: "mega_miner",
      type: "mega",
      name: "Мега Майнер",
      description: "Потужний бот для серйозних гравців",
      earnings_per_hour: 125,
      cost: 6000,
      max_level: 10,
      image: "gem"
    },
    {
      id: "quantum_miner",
      type: "quantum",
      name: "Квантовий Майнер",
      description: "Найпотужніший бот з квантовими технологіями",
      earnings_per_hour: 600,
      cost: 36000,
      max_level: 10,
      image: "rocket"
    },
    {
      id: "ai_miner",
      type: "ai",
      name: "AI Майнер",
      description: "Розумний бот з штучним інтелектом",
      earnings_per_hour: 3000,
      cost: 210000,
      max_level: 10,
      image: "brain"
    },
    {
      id: "cosmic_miner",
      type: "cosmic",
      name: "Космічний Майнер",
      description: "Легендарний бот з космічною енергією",
      earnings_per_hour: 15000,
      cost: 1200000,
      max_level: 10,
      image: "🌟"
    }
  ],
  upgrades: [
    {
      id: "energy_capacity",
      name: "Ємність енергії",
      description: "Збільшує максимальну енергію",
      type: "energy",
      icon: "zap",
      max_level: 10,
      levels: [
        { level: 1, cost: 100, effect: 100 },
        { level: 2, cost: 200, effect: 200 },
        { level: 3, cost: 400, effect: 300 },
        { level: 4, cost: 800, effect: 400 },
        { level: 5, cost: 1600, effect: 500 },
      ]
    },
    {
      id: "mining_power",
      name: "Потужність майнінгу",
      description: "Збільшує кількість монет за клік",
      type: "mining",
      icon: "pickaxe",
      max_level: 10,
      levels: [
        { level: 1, cost: 150, effect: 1 },
        { level: 2, cost: 300, effect: 2 },
        { level: 3, cost: 600, effect: 3 },
        { level: 4, cost: 1200, effect: 4 },
        { level: 5, cost: 2400, effect: 5 },
      ]
    },
    {
      id: "energy_regen",
      name: "Відновлення енергії",
      description: "Прискорює відновлення енергії",
      type: "energy",
      icon: "🔋",
      max_level: 10,
      levels: [
        { level: 1, cost: 200, effect: 1.2 },
        { level: 2, cost: 400, effect: 1.5 },
        { level: 3, cost: 800, effect: 2 },
        { level: 4, cost: 1600, effect: 2.5 },
        { level: 5, cost: 3200, effect: 3 },
      ]
    },
  ],
};

export const MinerSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<MinerSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBot, setEditingBot] = useState<MinerBot | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUpgrade, setEditingUpgrade] = useState<MinerUpgrade | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "miner_config")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading miner settings:", error);
        return;
      }

      if (data?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.value as any) });
      }
    } catch (error) {
      console.error("Error loading miner settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "miner_config",
          value: settings,
          updated_at: new Date().toISOString(),
        } as any);


      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Налаштування майнера збережено",
      });
    } catch (error: any) {
      console.error("Error saving miner settings:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof MinerSettings, value: number | boolean | MinerBot[]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addBot = () => {
    const newBot: MinerBot = {
      id: `bot_${Date.now()}`,
      type: "custom",
      name: "Новий Бот",
      description: "Опис бота",
      earnings_per_hour: 10,
      cost: 500,
      max_level: 10,
      image: "🤖"
    };
    setEditingBot(newBot);
    setIsDialogOpen(true);
  };

  const editBot = (bot: MinerBot) => {
    setEditingBot({ ...bot });
    setIsDialogOpen(true);
  };

  const deleteBot = (botId: string) => {
    if (confirm("Видалити цього бота?")) {
      updateSetting("bots", settings.bots.filter(b => b.id !== botId));
    }
  };

  const saveBot = () => {
    if (!editingBot) return;
    
    const existingIndex = settings.bots.findIndex(b => b.id === editingBot.id);
    if (existingIndex >= 0) {
      const updatedBots = [...settings.bots];
      updatedBots[existingIndex] = editingBot;
      updateSetting("bots", updatedBots);
    } else {
      updateSetting("bots", [...settings.bots, editingBot]);
    }
    
    setIsDialogOpen(false);
    setEditingBot(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editingBot) return;
    
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Помилка",
        description: "Розмір файлу не повинен перевищувати 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingBot.id}_${Date.now()}.${fileExt}`;
      const filePath = `miner-bots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      setEditingBot({ ...editingBot, image_url: publicUrl });
      
      toast({
        title: "Успішно",
        description: "Зображення завантажено",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося завантажити зображення",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Налаштування Майнер Боти
          </CardTitle>
          <CardDescription>
            Керуйте всіма параметрами майнер гри
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="energy" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="energy">
                <Zap className="w-4 h-4 mr-2" />
                Енергія
              </TabsTrigger>
              <TabsTrigger value="mining">
                <Coins className="w-4 h-4 mr-2" />
                Майнінг
              </TabsTrigger>
              <TabsTrigger value="bots">
                <Bot className="w-4 h-4 mr-2" />
                Боти
              </TabsTrigger>
              <TabsTrigger value="bot-management">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Керування ботами
              </TabsTrigger>
              <TabsTrigger value="rewards">
                <Coins className="w-4 h-4 mr-2" />
                Нагороди
              </TabsTrigger>
            </TabsList>

            {/* Energy Settings */}
            <TabsContent value="energy" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_energy">Максимальна енергія</Label>
                  <Input
                    id="max_energy"
                    type="number"
                    value={settings.max_energy}
                    onChange={(e) => updateSetting("max_energy", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Максимальна кількість енергії користувача
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_per_tap">Енергія за клік</Label>
                  <Input
                    id="energy_per_tap"
                    type="number"
                    value={settings.energy_per_tap}
                    onChange={(e) => updateSetting("energy_per_tap", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Скільки енергії витрачається за один клік
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_regen_rate">Швидкість відновлення</Label>
                  <Input
                    id="energy_regen_rate"
                    type="number"
                    value={settings.energy_regen_rate}
                    onChange={(e) => updateSetting("energy_regen_rate", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Кількість енергії за інтервал
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_regen_interval">Інтервал відновлення (сек)</Label>
                  <Input
                    id="energy_regen_interval"
                    type="number"
                    value={settings.energy_regen_interval}
                    onChange={(e) => updateSetting("energy_regen_interval", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Як часто відновлюється енергія (секунди)
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Mining Settings */}
            <TabsContent value="mining" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_mining_power">Базова потужність майнінгу</Label>
                  <Input
                    id="base_mining_power"
                    type="number"
                    value={settings.base_mining_power}
                    onChange={(e) => updateSetting("base_mining_power", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Базова кількість монет за клік
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mining_multiplier">Множник майнінгу</Label>
                  <Input
                    id="mining_multiplier"
                    type="number"
                    step="0.1"
                    value={settings.mining_multiplier}
                    onChange={(e) => updateSetting("mining_multiplier", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Глобальний множник видобутку
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_claim_hours">Макс. години накопичення (застаріле)</Label>
                  <Input
                    id="max_claim_hours"
                    type="number"
                    value={settings.max_claim_hours}
                    onChange={(e) => updateSetting("max_claim_hours", parseInt(e.target.value))}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Використовуйте налаштування сховища нижче
                  </p>
                </div>

                <Separator />

                <h3 className="font-semibold text-lg flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Налаштування Сховища</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storage_base_hours">Базова кількість годин (рівень 1)</Label>
                    <Input
                      id="storage_base_hours"
                      type="number"
                      value={settings.storage_base_hours}
                      onChange={(e) => updateSetting("storage_base_hours", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Години накопичення на 1 рівні сховища
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_hours_per_level">Години за рівень</Label>
                    <Input
                      id="storage_hours_per_level"
                      type="number"
                      value={settings.storage_hours_per_level}
                      onChange={(e) => updateSetting("storage_hours_per_level", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      +годин за кожен рівень покращення
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_base_cost">Базова ціна покращення</Label>
                    <Input
                      id="storage_base_cost"
                      type="number"
                      value={settings.storage_base_cost}
                      onChange={(e) => updateSetting("storage_base_cost", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ціна першого покращення (1→2)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_cost_multiplier">Множник ціни</Label>
                    <Input
                      id="storage_cost_multiplier"
                      type="number"
                      step="0.1"
                      value={settings.storage_cost_multiplier}
                      onChange={(e) => updateSetting("storage_cost_multiplier", parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Множник для розрахунку ціни наступних рівнів
                    </p>
                  </div>
                </div>

                <Card className="p-4 bg-blue-500/10 border-blue-500/30">
                  <p className="text-sm font-semibold mb-2">Приклад прогресії:</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• Рівень 1: {settings.storage_base_hours}год (базовий)</p>
                    <p>• Рівень 2: {settings.storage_base_hours + settings.storage_hours_per_level}год ({settings.storage_base_cost} монет)</p>
                    <p>• Рівень 3: {settings.storage_base_hours + settings.storage_hours_per_level * 2}год ({Math.floor(settings.storage_base_cost * settings.storage_cost_multiplier)} монет)</p>
                    <p>• Рівень 4: {settings.storage_base_hours + settings.storage_hours_per_level * 3}год ({Math.floor(settings.storage_base_cost * Math.pow(settings.storage_cost_multiplier, 2))} монет)</p>
                    <p>• Рівень 5: {settings.storage_base_hours + settings.storage_hours_per_level * 4}год ({Math.floor(settings.storage_base_cost * Math.pow(settings.storage_cost_multiplier, 3))} монет)</p>
                  </div>
                </Card>

                <div className="space-y-2">
                  <Label htmlFor="auto_collect_interval">Інтервал авто-збору (хв)</Label>
                  <Input
                    id="auto_collect_interval"
                    type="number"
                    value={settings.auto_collect_interval}
                    onChange={(e) => updateSetting("auto_collect_interval", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Як часто авто-збір перевіряє дохід (хвилини)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto_collect_energy_cost">Вартість авто-збору (енергія)</Label>
                  <Input
                    id="auto_collect_energy_cost"
                    type="number"
                    value={settings.auto_collect_energy_cost}
                    onChange={(e) => updateSetting("auto_collect_energy_cost", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Скільки енергії витрачається на авто-збір
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto_collect_default" className="flex items-center gap-2">
                    Авто-збір за замовчуванням
                  </Label>
                  <Switch
                    id="auto_collect_default"
                    checked={settings.auto_collect_enabled_default}
                    onCheckedChange={(checked) => updateSetting("auto_collect_enabled_default", checked)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Чи увімкнений авто-збір для нових користувачів
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Bot Management */}
            <TabsContent value="bot-management" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Список ботів</h3>
                  <p className="text-sm text-muted-foreground">Керуйте ботами майнер гри</p>
                </div>
                <Button onClick={addBot} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Додати бота
                </Button>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Іконка</TableHead>
                      <TableHead>Назва</TableHead>
                      <TableHead>Дохід/год</TableHead>
                      <TableHead>Ціна</TableHead>
                      <TableHead>Макс. рівень</TableHead>
                      <TableHead>Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.bots.map((bot) => (
                      <TableRow key={bot.id}>
                        <TableCell className="text-2xl">{bot.image}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{bot.name}</div>
                            <div className="text-xs text-muted-foreground">{bot.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>{bot.earnings_per_hour}</TableCell>
                        <TableCell>{bot.cost}</TableCell>
                        <TableCell>{bot.max_level}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => editBot(bot)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteBot(bot.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {settings.bots.map((bot) => (
                  <Card key={bot.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{bot.image}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{bot.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Дохід:</span>
                              <div className="font-semibold">{bot.earnings_per_hour}/г</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ціна:</span>
                              <div className="font-semibold">{bot.cost}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Рівень:</span>
                              <div className="font-semibold">{bot.max_level}</div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button variant="outline" size="sm" onClick={() => editBot(bot)} className="flex-1">
                              <Edit className="w-4 h-4 mr-1" />
                              Редагувати
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteBot(bot.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Bot Settings */}
            <TabsContent value="bots" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bot_upgrade_cost_multiplier">Множник вартості покращення</Label>
                  <Input
                    id="bot_upgrade_cost_multiplier"
                    type="number"
                    step="0.1"
                    value={settings.bot_upgrade_cost_multiplier}
                    onChange={(e) => updateSetting("bot_upgrade_cost_multiplier", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    На скільки зростає ціна з кожним рівнем (наприклад, 1.5 = +50%)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot_level_earning_multiplier">Множник доходу за рівень</Label>
                  <Input
                    id="bot_level_earning_multiplier"
                    type="number"
                    step="0.1"
                    value={settings.bot_level_earning_multiplier}
                    onChange={(e) => updateSetting("bot_level_earning_multiplier", parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    На скільки зростає дохід з кожним рівнем (наприклад, 1.2 = +20%)
                  </p>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Формула розрахунку:</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Вартість бота рівня N:</strong> базова_ціна × (множник_вартості ^ (N-1))
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Дохід бота рівня N:</strong> базовий_дохід × (множник_доходу ^ (N-1))
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Приклад: Бот з базовою ціною 100₴ та множником 1.5:
                      <br />Рівень 1: 100₴ | Рівень 2: 150₴ | Рівень 3: 225₴
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rewards Settings */}
            <TabsContent value="rewards" className="space-y-4 mt-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Щоденні нагороди</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="daily_reward_base">Базова щоденна винагорода</Label>
                      <Input
                        id="daily_reward_base"
                        type="number"
                        value={settings.daily_reward_base}
                        onChange={(e) => updateSetting("daily_reward_base", parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Базова кількість монет за щоденний вхід
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="daily_reward_streak_bonus">Бонус за серію днів</Label>
                      <Input
                        id="daily_reward_streak_bonus"
                        type="number"
                        value={settings.daily_reward_streak_bonus}
                        onChange={(e) => updateSetting("daily_reward_streak_bonus", parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Додаткові монети за кожен день підряд
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Стартові бонуси</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="starting_coins">Початкові монети</Label>
                      <Input
                        id="starting_coins"
                        type="number"
                        value={settings.starting_coins}
                        onChange={(e) => updateSetting("starting_coins", parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Скільки монет отримає новий користувач
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="starting_energy">Початкова енергія</Label>
                      <Input
                        id="starting_energy"
                        type="number"
                        value={settings.starting_energy}
                        onChange={(e) => updateSetting("starting_energy", parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Початкова енергія для нових користувачів
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Приклад нагород:</h4>
                    <p className="text-sm text-muted-foreground">
                      День 1: {settings.daily_reward_base} монет
                      <br />День 2: {settings.daily_reward_base + settings.daily_reward_streak_bonus} монет
                      <br />День 3: {settings.daily_reward_base + settings.daily_reward_streak_bonus * 2} монет
                      <br />...
                      <br />День 7: {settings.daily_reward_base + settings.daily_reward_streak_bonus * 6} монет
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Збереження..." : "Зберегти налаштування"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Bot Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBot?.id.startsWith('bot_') && !settings.bots.find(b => b.id === editingBot.id) ? 'Додати' : 'Редагувати'} бота</DialogTitle>
            <DialogDescription>
              Налаштуйте параметри майнер бота
            </DialogDescription>
          </DialogHeader>
          
          {editingBot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bot_name">Назва</Label>
                  <Input
                    id="bot_name"
                    value={editingBot.name}
                    onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot_image">Іконка (emoji)</Label>
                  <Input
                    id="bot_image"
                    value={editingBot.image}
                    onChange={(e) => setEditingBot({ ...editingBot, image: e.target.value })}
                    placeholder="🤖"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bot_description">Опис</Label>
                <Textarea
                  id="bot_description"
                  value={editingBot.description}
                  onChange={(e) => setEditingBot({ ...editingBot, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bot_earnings">Дохід/год</Label>
                  <Input
                    id="bot_earnings"
                    type="number"
                    value={editingBot.earnings_per_hour}
                    onChange={(e) => setEditingBot({ ...editingBot, earnings_per_hour: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot_cost">Ціна</Label>
                  <Input
                    id="bot_cost"
                    type="number"
                    value={editingBot.cost}
                    onChange={(e) => setEditingBot({ ...editingBot, cost: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bot_max_level">Макс. рівень</Label>
                  <Input
                    id="bot_max_level"
                    type="number"
                    value={editingBot.max_level}
                    onChange={(e) => setEditingBot({ ...editingBot, max_level: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={saveBot}>
              Зберегти бота
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
