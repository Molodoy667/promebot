import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { 
  Cpu, 
  Zap, 
  TrendingUp, 
  ShoppingCart, 
  Award,
  CircleDollarSign,
  Coins,
  Bot,
  Rocket,
  Settings,
  Star,
  Sparkles,
  Gift,
  Trophy,
  DollarSign,
  Gem,
  Brain,
  AlertTriangle,
  Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyRewards } from "@/components/miner/DailyRewards";
import { Achievements } from "@/components/miner/Achievements";
import { AutoCollectSettings } from "@/components/miner/AutoCollectSettings";
import { StorageUpgrade } from "@/components/miner/StorageUpgrade";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface MinerBot {
  id: string;
  type: string;
  level: number;
  earnings_per_hour: number;
  cost: number;
  owned: number;
  max_level: number;
  image: string;
  name: string;
  description: string;
}

interface UserMinerData {
  user_id: string;
  total_earned: number;
  miners_owned: Record<string, { level: number; owned: number }>;
  last_claim: string;
  auto_collect_enabled?: boolean;
  auto_collect_level?: number;
  last_auto_collect?: string;
  energy?: number;
  max_energy?: number;
  energy_regen_per_min?: number;
  coins_per_click?: number;
  last_energy_update?: string;
  storage_level?: number;
  storage_max_hours?: number;
}

interface UserProfile {
  bonus_balance: number;
  is_vip?: boolean;
}

const MINER_BOTS: MinerBot[] = [
  {
    id: "basic_miner",
    type: "basic",
    name: "Базовий Майнер",
    description: "Простий бот для початківців",
    level: 1,
    earnings_per_hour: 5,
    cost: 150,
    owned: 0,
    max_level: 10,
    image: "bot"
  },
  {
    id: "turbo_miner",
    type: "turbo",
    name: "Турбо Майнер",
    description: "Швидкий бот з підвищеною продуктивністю",
    level: 1,
    earnings_per_hour: 30,
    cost: 1200,
    owned: 0,
    max_level: 10,
    image: "zap"
  },
  {
    id: "mega_miner",
    type: "mega",
    name: "Мега Майнер",
    description: "Потужний бот для серйозних гравців",
    level: 1,
    earnings_per_hour: 125,
    cost: 6000,
    owned: 0,
    max_level: 10,
    image: "gem"
  },
  {
    id: "quantum_miner",
    type: "quantum",
    name: "Квантовий Майнер",
    description: "Найпотужніший бот з квантовими технологіями",
    level: 1,
    earnings_per_hour: 600,
    cost: 36000,
    owned: 0,
    max_level: 10,
    image: "rocket"
  },
  {
    id: "ai_miner",
    type: "ai",
    name: "AI Майнер",
    description: "Розумний бот з штучним інтелектом",
    level: 1,
    earnings_per_hour: 3000,
    cost: 210000,
    owned: 0,
    max_level: 10,
    image: "brain"
  },
  {
    id: "cosmic_miner",
    type: "cosmic",
    name: "Космічний Майнер",
    description: "Легендарний бот з космічною енергією",
    level: 1,
    earnings_per_hour: 15000,
    cost: 1200000,
    owned: 0,
    max_level: 10,
    image: "star"
  }
];

// Icon mapping helper
const getMinerIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    'zap': Zap,
    'gem': Gem,
    'rocket': Rocket,
    'brain': Brain,
    'star': Star,
    'cpu': Cpu,
  };
  return iconMap[iconName] || Bot;
};

const MinerGame = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserMinerData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [miners, setMiners] = useState<MinerBot[]>(MINER_BOTS);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [selectedTab, setSelectedTab] = useState("mine");
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showAutoCollect, setShowAutoCollect] = useState(false);
  const [clickCoins, setClickCoins] = useState<{id: number; coins: number; x: number; y: number}[]>([]);
  const [energyRegenProgress, setEnergyRegenProgress] = useState(0);
  const [timeToNextEnergy, setTimeToNextEnergy] = useState("");
  const [minerConfig, setMinerConfig] = useState({
    max_claim_hours: 6,
    bot_upgrade_cost_multiplier: 1.5,
    bot_level_earning_multiplier: 1.2,
    starting_coins: 0,
    max_energy: 1000,
    energy_per_tap: 1,
    energy_regen_rate: 1,
    energy_regen_interval: 10,
    base_mining_power: 1,
    daily_reward_base: 100,
    daily_reward_streak_bonus: 50,
    bots: MINER_BOTS,
  });

  useEffect(() => {
    checkAuth();
    loadMinerConfig();
  }, [navigate]);

  const loadMinerConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "miner_config")
        .single();

      if (data?.value) {
        const cfg = data.value as any;
        const config = {
          max_claim_hours: cfg.max_claim_hours || 6,
          bot_upgrade_cost_multiplier: cfg.bot_upgrade_cost_multiplier || 1.5,
          bot_level_earning_multiplier: cfg.bot_level_earning_multiplier || 1.2,
          starting_coins: cfg.starting_coins || 0,
          max_energy: cfg.max_energy || 1000,
          energy_per_tap: cfg.energy_per_tap || 1,
          energy_regen_rate: cfg.energy_regen_rate || 1,
          energy_regen_interval: cfg.energy_regen_interval || 10,
          base_mining_power: cfg.base_mining_power || 1,
          daily_reward_base: cfg.daily_reward_base || 100,
          daily_reward_streak_bonus: cfg.daily_reward_streak_bonus || 50,
          bots: cfg.bots || MINER_BOTS,
        };
        setMinerConfig(config);
        
        // Update miners list with bots from config
        if (cfg.bots && Array.isArray(cfg.bots)) {
          setMiners(cfg.bots.map((bot: any) => ({
            ...bot,
            level: 1,
            owned: 0
          })));
        }
      }
    } catch (error) {
      console.error("Error loading miner config:", error);
    }
  };

  useEffect(() => {
    if (!userData) return;
    
    // Update pending earnings every second
    const earningsInterval = setInterval(() => {
      const lastClaim = new Date(userData.last_claim).getTime();
      const now = Date.now();
      const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
      const cappedHours = Math.min(hoursPassed, minerConfig.max_claim_hours);
      const totalEarningsPerHour = calculateTotalEarningsPerHour();
      setPendingEarnings(Math.floor(totalEarningsPerHour * cappedHours));
    }, 1000);

    // Auto-collect interval
    const autoCollectInterval = setInterval(() => {
      if (userData.auto_collect_enabled) {
        checkAndAutoCollect();
      }
    }, 10000);

    // Energy regeneration interval - update energy every 10 seconds
    const energyInterval = setInterval(async () => {
      if (userData.energy !== undefined && userData.max_energy !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Call update_miner_energy to sync with server
        const { data, error } = await supabase.rpc('update_miner_energy', {
          p_user_id: user.id
        });

        if (!error && data) {
          const result = data as { success?: boolean; energy?: number; max_energy?: number; last_energy_update?: string };
          if (result.success) {
            setUserData(prev => prev ? {
              ...prev,
              energy: result.energy || prev.energy,
              max_energy: result.max_energy || prev.max_energy,
              last_energy_update: result.last_energy_update || prev.last_energy_update
            } : prev);
          }
        }
      }
    }, 10000); // Update every 10 seconds

    // Energy progress bar - update every second for smooth animation
    const energyProgressInterval = setInterval(() => {
      if (userData.energy !== undefined && userData.max_energy !== undefined && userData.energy < userData.max_energy) {
        const regenRate = userData.energy_regen_per_min || 0.1; // 0.1 energy per minute = 1 energy per 10 minutes
        const minutesPerEnergy = 1 / regenRate; // 10 minutes for 0.1 rate
        const secondsPerEnergy = minutesPerEnergy * 60; // 600 seconds (10 minutes)
        
        // Calculate time passed since last energy update
        const lastUpdate = new Date(userData.last_energy_update || Date.now()).getTime();
        const now = Date.now();
        const millisecondsPassed = now - lastUpdate;
        const secondsPassed = millisecondsPassed / 1000;
        
        // Calculate how many full energy points have been regenerated
        const fullEnergyPointsGained = Math.floor(secondsPassed / secondsPerEnergy);
        
        // Calculate progress within current energy point cycle
        const secondsInCurrentCycle = secondsPassed - (fullEnergyPointsGained * secondsPerEnergy);
        const progress = (secondsInCurrentCycle / secondsPerEnergy) * 100;
        setEnergyRegenProgress(Math.min(progress, 100));
        
        // Calculate time remaining to next energy point
        const remainingSeconds = secondsPerEnergy - secondsInCurrentCycle;
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = Math.floor(remainingSeconds % 60);
        setTimeToNextEnergy(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setEnergyRegenProgress(0);
        setTimeToNextEnergy("");
      }
    }, 1000);

    return () => {
      clearInterval(earningsInterval);
      clearInterval(autoCollectInterval);
      clearInterval(energyInterval);
      clearInterval(energyProgressInterval);
    };
  }, [userData?.user_id, userData?.last_claim, userData?.auto_collect_enabled, userData?.energy, userData?.max_energy, userData?.energy_regen_per_min, userData?.last_energy_update]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    loadUserData();
  };

  const checkAndAutoCollect = async () => {
    if (!userData || !userProfile) return;

    const autoCollectLevel = userData.auto_collect_level || 1;
    const intervalMinutes = [5, 3, 1, 0.5][autoCollectLevel - 1];
    
    const lastAutoCollect = userData.last_auto_collect 
      ? new Date(userData.last_auto_collect).getTime()
      : new Date(userData.last_claim).getTime();
    
    const now = Date.now();
    const minutesPassed = (now - lastAutoCollect) / (1000 * 60);

    // Calculate current earnings
    const lastClaim = new Date(userData.last_claim).getTime();
    const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
    const totalEarningsPerHour = calculateTotalEarningsPerHour();
    const currentEarnings = Math.floor(totalEarningsPerHour * hoursPassed);

    if (minutesPassed >= intervalMinutes && currentEarnings > 0) {
      await claimEarnings(true);
    }
  };

  const handleManualClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!userData) return;

    const hasEnergy = userData.energy !== undefined && userData.energy !== null;
    
    if (hasEnergy && userData.energy! < 1) {
      toast({
        title: "Недостатньо енергії",
        description: "Зачекайте відновлення енергії",
        variant: "destructive",
      });
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast({
          title: "Помилка",
          description: "Увійдіть в акаунт",
          variant: "destructive",
        });
        return;
      }

      // If energy system not available, show animation only
      if (!hasEnergy) {
        const coinId = Date.now() + Math.random();
        const randomCoins = Math.floor(Math.random() * 3) + 1;
        setClickCoins(prev => [...prev, { id: coinId, coins: randomCoins, x, y }]);
        
        setTimeout(() => {
          setClickCoins(prev => prev.filter(c => c.id !== coinId));
        }, 1000);
        
        toast({
          title: "Інформація",
          description: "Система енергії буде доступна після оновлення БД",
        });
        return;
      }

      const { data, error } = await supabase.rpc('miner_manual_click', {
        p_user_id: currentUser.id
      });

      if (error) {
        console.error("RPC error:", error);
        throw error;
      }

      const result = data as { success?: boolean; coins_earned?: number; error?: string } | null;
      if (result?.success) {
        const coinId = Date.now() + Math.random();
        setClickCoins(prev => [...prev, { id: coinId, coins: result.coins_earned || 0, x, y }]);
        
        setTimeout(() => {
          setClickCoins(prev => prev.filter(c => c.id !== coinId));
        }, 1000);

        await loadUserData();
      } else {
        toast({
          title: "Помилка",
          description: result?.error || "Помилка при кліці",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Click error:", error);
      toast({
        title: "Помилка",
        description: error.message || "Невідома помилка",
        variant: "destructive",
      });
    }
  };

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Помилка",
          description: "Потрібна авторизація",
          variant: "destructive",
        });
        return;
      }

      // Load profile with bonus_balance and VIP status
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", user.id)
        .single();
      
      // Check VIP status
      let isVip = false;
      try {
        const { data: vipData, error: vipError } = await supabase
          .from("vip_subscriptions")
          .select("expires_at")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!vipError && vipData) {
          isVip = new Date(vipData.expires_at) > new Date();
        }
      } catch (error) {
        console.log("VIP check failed, assuming non-VIP", error);
      }

      if (profileError) throw profileError;
      setUserProfile({ ...profile, is_vip: isVip });

      // Load game data
      const { data, error } = await supabase
        .from("miner_game_data")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) {
        // Create initial data + give starting bonus
        const initialData = {
          user_id: user.id,
          total_earned: 0,
          miners_owned: {},
          last_claim: new Date().toISOString()
        };

        const { data: newData, error: insertError } = await supabase
          .from("miner_game_data")
          .insert(initialData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Give 1000 bonus coins as starting gift
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ bonus_balance: (profile?.bonus_balance || 0) + 1000 })
          .eq("id", user.id);

        if (updateError) throw updateError;

        setUserData({
          ...newData,
          miners_owned: (newData.miners_owned || {}) as Record<string, { level: number; owned: number }>
        });
        setUserProfile({ bonus_balance: (profile?.bonus_balance || 0) + 1000 });
        
        toast({
          title: "Вітаємо!",
          description: "Ви отримали 1,000 бонусних монет для початку гри!",
          duration: 5000,
        });
      } else {
        // Update energy in background before setting data
        try {
          const { data: energyData, error: energyError } = await supabase.rpc('update_miner_energy', {
            p_user_id: user.id
          });

          if (!energyError && energyData) {
            const result = energyData as { success?: boolean; energy?: number; max_energy?: number; last_energy_update?: string };
            if (result.success) {
              // Merge updated energy with existing data
              const typedData = {
                ...data,
                energy: result.energy,
                max_energy: result.max_energy,
                last_energy_update: result.last_energy_update || data.last_energy_update, // Use RPC returned time
                miners_owned: (data.miners_owned || {}) as Record<string, { level: number; owned: number }>
              };
              setUserData(typedData);
              updateMinersFromUserData(typedData);
            } else {
              // If energy update failed, use original data
              const typedData = {
                ...data,
                miners_owned: (data.miners_owned || {}) as Record<string, { level: number; owned: number }>
              };
              setUserData(typedData);
              updateMinersFromUserData(typedData);
            }
          } else {
            // If RPC failed, use original data
            const typedData = {
              ...data,
              miners_owned: (data.miners_owned || {}) as Record<string, { level: number; owned: number }>
            };
            setUserData(typedData);
            updateMinersFromUserData(typedData);
          }
        } catch (error) {
          console.error("Error updating energy on load:", error);
          // Fallback to original data
          const typedData = {
            ...data,
            miners_owned: (data.miners_owned || {}) as Record<string, { level: number; owned: number }>
          };
          setUserData(typedData);
          updateMinersFromUserData(typedData);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast({
        title: "Помилка",
        description: "Помилка завантаження даних",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMinersFromUserData = (data: UserMinerData) => {
    const updatedMiners = minerConfig.bots.map(miner => {
      const owned = data.miners_owned[miner.id];
      if (owned) {
        // Базова ціна та earnings з MINER_BOTS
        const baseCost = minerConfig.bots.find(m => m.id === miner.id)?.cost || miner.cost;
        const baseEarnings = minerConfig.bots.find(m => m.id === miner.id)?.earnings_per_hour || miner.earnings_per_hour;
        
        return {
          ...miner,
          level: owned.level,
          owned: owned.owned,
          // Експоненціальний ріст: кожен рівень коштує більше
          cost: Math.floor(baseCost * Math.pow(minerConfig.bot_upgrade_cost_multiplier, owned.level - 1)),
          // Earnings ростуть з конфігурованим множником
          earnings_per_hour: Math.floor(baseEarnings * Math.pow(minerConfig.bot_level_earning_multiplier, owned.level - 1))
        };
      }
      return miner;
    });
    setMiners(updatedMiners);
  };

  const calculateTotalEarningsPerHour = () => {
    return miners.reduce((total, miner) => {
      return total + (miner.earnings_per_hour * miner.owned);
    }, 0);
  };

  const updateAchievementProgress = async (
    totalEarned: number, 
    totalBots: number, 
    isFirstBot: boolean = false,
    isFirstUpgrade: boolean = false,
    maxBotLevel: number = 0
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all achievements
      const { data: achievements } = await supabase
        .from('miner_achievements')
        .select('*');

      if (!achievements) return;

      // Check and update progress for each achievement
      for (const achievement of achievements) {
        let progress = 0;
        let completed = false;

        switch (achievement.achievement_key) {
          case 'first_bot':
            progress = isFirstBot ? 1 : totalBots > 0 ? 1 : 0;
            completed = totalBots > 0;
            break;
          case 'own_3_bots':
            progress = totalBots;
            completed = totalBots >= 3;
            break;
          case 'upgrade_first':
            progress = isFirstUpgrade ? 1 : maxBotLevel > 1 ? 1 : 0;
            completed = maxBotLevel > 1;
            break;
          case 'earn_1k':
            progress = totalEarned;
            completed = totalEarned >= 1000;
            break;
          case 'earn_10k':
            progress = totalEarned;
            completed = totalEarned >= 10000;
            break;
          case 'earn_50k':
            progress = totalEarned;
            completed = totalEarned >= 50000;
            break;
          case 'magnate':
            progress = totalEarned;
            completed = totalEarned >= 100000;
            break;
          case 'earn_1m':
            progress = totalEarned;
            completed = totalEarned >= 1000000;
            break;
          case 'earn_10k_per_hour':
            progress = calculateTotalEarningsPerHour();
            completed = calculateTotalEarningsPerHour() >= 10000;
            break;
          case 'max_income':
            progress = calculateTotalEarningsPerHour();
            completed = calculateTotalEarningsPerHour() >= 100000;
            break;
          case 'level_5_bot':
            progress = maxBotLevel;
            completed = maxBotLevel >= 5;
            break;
          case 'all_bot_types':
            const uniqueTypes = Object.keys(userData?.miners_owned || {}).length;
            progress = uniqueTypes;
            completed = uniqueTypes >= 6;
            break;
          default:
            continue;
        }

        // Upsert user achievement
        const { data: existingAchievement } = await supabase
          .from('miner_user_achievements')
          .select('*')
          .eq('user_id', user.id)
          .eq('achievement_id', achievement.id)
          .single();

        if (existingAchievement && existingAchievement.completed) {
          // Already completed, skip
          continue;
        }

        if (completed && !existingAchievement?.completed) {
          // Complete achievement and give reward
          await supabase
            .from('miner_user_achievements')
            .upsert({
              user_id: user.id,
              achievement_id: achievement.id,
              progress: achievement.requirement,
              completed: true,
              completed_at: new Date().toISOString()
            }, { onConflict: 'user_id,achievement_id' });

          // Give reward
          const { data: profile } = await supabase
            .from('profiles')
            .select('bonus_balance')
            .eq('id', user.id)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ bonus_balance: profile.bonus_balance + achievement.reward_coins })
              .eq('id', user.id);

            toast({
              title: `Досягнення отримано: ${achievement.name}!`,
              description: `Винагорода: +${achievement.reward_coins.toLocaleString()} монет`,
              duration: 5000,
            });
          }
        } else {
          // Update progress
          await supabase
            .from('miner_user_achievements')
            .upsert({
              user_id: user.id,
              achievement_id: achievement.id,
              progress,
              completed: false
            }, { onConflict: 'user_id,achievement_id' });
        }
      }
    } catch (error) {
      console.error('Error updating achievement progress:', error);
    }
  };

  const buyMiner = async (minerId: string) => {
    if (!userData || !userProfile) return;

    const miner = miners.find(m => m.id === minerId);
    if (!miner) return;

    if (userProfile.bonus_balance < miner.cost) {
      toast({
        title: "Недостатньо монет",
        description: "Недостатньо бонусних монет!",
        variant: "destructive",
      });
      return;
    }

    const newBalance = userProfile.bonus_balance - miner.cost;
    const newMinersOwned = { ...userData.miners_owned };
    
    const isFirstBot = !newMinersOwned[minerId];
    
    if (!newMinersOwned[minerId]) {
      newMinersOwned[minerId] = { level: 1, owned: 1 };
    } else {
      newMinersOwned[minerId].owned += 1;
    }

    try {
      // Update profile bonus_balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ bonus_balance: newBalance })
        .eq("id", userData.user_id);

      if (profileError) throw profileError;

      // Update game data
      const { error } = await supabase
        .from("miner_game_data")
        .update({ miners_owned: newMinersOwned })
        .eq("user_id", userData.user_id);

      if (error) throw error;

      setUserProfile({ bonus_balance: newBalance });
      setUserData({ ...userData, miners_owned: newMinersOwned });
      updateMinersFromUserData({ ...userData, miners_owned: newMinersOwned });
      
      toast({
        title: `Куплено ${miner.name}!`,
        description: `+${miner.earnings_per_hour} монет/годину`,
      });
      
      // Update achievement progress
      const totalBots = Object.values(newMinersOwned).reduce((sum, m) => sum + m.owned, 0);
      await updateAchievementProgress(userData.total_earned, totalBots, isFirstBot);
    } catch (error) {
      console.error("Error buying miner:", error);
      toast({
        title: "Помилка",
        description: "Помилка покупки",
        variant: "destructive",
      });
    }
  };

  const upgradeMiner = async (minerId: string) => {
    if (!userData || !userProfile) return;

    const miner = miners.find(m => m.id === minerId);
    if (!miner || !miner.owned) {
      toast({
        title: "Помилка",
        description: "Спочатку купіть цього бота!",
        variant: "destructive",
      });
      return;
    }

    if (miner.level >= miner.max_level) {
      toast({
        title: "Максимальний рівень",
        description: "Досягнуто максимальний рівень!",
        variant: "destructive",
      });
      return;
    }

    // Базова ціна з MINER_BOTS
    const baseCost = MINER_BOTS.find(m => m.id === minerId)?.cost || miner.cost;
    // Ціна наступного рівня = базова * множник^level
    const upgradeCost = Math.floor(baseCost * Math.pow(minerConfig.bot_upgrade_cost_multiplier, miner.level));

    if (userProfile.bonus_balance < upgradeCost) {
      toast({
        title: "Недостатньо монет",
        description: "Недостатньо бонусних монет для покращення!",
        variant: "destructive",
      });
      return;
    }

    const newBalance = userProfile.bonus_balance - upgradeCost;
    const newMinersOwned = { ...userData.miners_owned };
    const isFirstUpgrade = newMinersOwned[minerId].level === 1;
    newMinersOwned[minerId].level += 1;

    try {
      // Update profile bonus_balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ bonus_balance: newBalance })
        .eq("id", userData.user_id);

      if (profileError) throw profileError;

      // Update game data
      const { error } = await supabase
        .from("miner_game_data")
        .update({ miners_owned: newMinersOwned })
        .eq("user_id", userData.user_id);

      if (error) throw error;

      setUserProfile({ bonus_balance: newBalance });
      setUserData({ ...userData, miners_owned: newMinersOwned });
      updateMinersFromUserData({ ...userData, miners_owned: newMinersOwned });
      
      const baseEarnings = MINER_BOTS.find(m => m.id === minerId)?.earnings_per_hour || 0;
      const newEarnings = Math.floor(baseEarnings * Math.pow(minerConfig.bot_level_earning_multiplier, newMinersOwned[minerId].level - 1));
      
      toast({
        title: `${miner.name} покращено до рівня ${newMinersOwned[minerId].level}!`,
        description: `Новий заробіток: ${newEarnings.toLocaleString()}/год`,
      });
      
      // Update achievement progress
      const totalBots = Object.values(newMinersOwned).reduce((sum, m) => sum + m.owned, 0);
      await updateAchievementProgress(userData.total_earned, totalBots, false, isFirstUpgrade, newMinersOwned[minerId].level);
    } catch (error) {
      console.error("Error upgrading miner:", error);
      toast({
        title: "Помилка",
        description: "Помилка покращення",
        variant: "destructive",
      });
    }
  };

  const claimEarnings = async (isAutoCollect = false) => {
    if (!userData || !userProfile || claiming) return;

    setClaiming(true);

    try {
      const lastClaim = new Date(userData.last_claim).getTime();
      const now = Date.now();
      const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
      
      // Max 6 hours cap
      const cappedHours = Math.min(hoursPassed, 6);
      
      const totalEarningsPerHour = calculateTotalEarningsPerHour();
      const earnings = Math.floor(totalEarningsPerHour * cappedHours);

      if (earnings === 0) {
        toast({
          title: "Інформація",
          description: "Поки що нічого не зароблено",
        });
        return;
      }

      const newBalance = userProfile.bonus_balance + earnings;
      const newTotalEarned = userData.total_earned + earnings;

      // Update profile bonus_balance
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ bonus_balance: newBalance })
        .eq("id", userData.user_id);

      if (profileError) throw profileError;

      // Update game data
      const updateData: any = {
        total_earned: newTotalEarned,
        last_claim: new Date().toISOString()
      };
      
      if (isAutoCollect) {
        updateData.last_auto_collect = new Date().toISOString();
      }

      const { error } = await supabase
        .from("miner_game_data")
        .update(updateData)
        .eq("user_id", userData.user_id);

      if (error) throw error;

      setUserProfile({ bonus_balance: newBalance });
      setUserData({
        ...userData,
        total_earned: newTotalEarned,
        last_claim: new Date().toISOString(),
        last_auto_collect: isAutoCollect ? new Date().toISOString() : userData.last_auto_collect
      });

      setPendingEarnings(0);

      if (!isAutoCollect) {
        toast({
          title: `Зібрано ${earnings.toLocaleString()} бонусних монет!`,
          description: `Загальний заробіток: ${newTotalEarned.toLocaleString()}`,
        });
      } else {
        toast({
          title: `Автозбір: +${earnings.toLocaleString()} монет`,
          description: "Монети автоматично додано",
        });
      }
      
      // Update achievement progress
      const totalBots = Object.values(userData.miners_owned).reduce((sum, m) => sum + m.owned, 0);
      const maxLevel = Math.max(...Object.values(userData.miners_owned).map(m => m.level), 0);
      await updateAchievementProgress(newTotalEarned, totalBots, false, false, maxLevel);
    } catch (error) {
      console.error("Error claiming earnings:", error);
      toast({
        title: "Помилка",
        description: "Помилка збору коштів",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  const totalEarningsPerHour = calculateTotalEarningsPerHour();
  const totalMinersOwned = miners.reduce((sum, m) => sum + m.owned, 0);

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto p-4 space-y-6 pb-20">
        <PageHeader
          icon={Cpu}
          title="Майнер Гра"
          description="Збирайте монети, купуйте ботів та автоматизуйте заробіток"
        >
          <div className="flex gap-2 mt-4">
            <BonusBalanceDisplay amount={userProfile?.bonus_balance || 0} />
          </div>
        </PageHeader>
      
      {/* Header Stats */}
      <div className="glass-card p-6 rounded-2xl border-2 border-primary/20">
        {/* Manual Mining Section - Hamster Kombat Style */}
        <div className="relative mb-6 p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-2xl border-2 border-purple-500/30 overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-pulse" />
          
          <div className="relative z-10">
            {/* Energy bar at top */}
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  ЕНЕРГІЯ
                </span>
                <span className="text-white">{userData?.energy || 0} / {userData?.max_energy || 100}</span>
              </div>
              <div className="h-4 bg-gray-900/50 rounded-full overflow-hidden border-2 border-cyan-500/30">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  style={{ width: `${((userData?.energy || 0) / (userData?.max_energy || 100)) * 100}%` }}
                />
              </div>
              
              {/* Energy regeneration progress */}
              {userData?.energy !== undefined && userData?.max_energy !== undefined && userData.energy < userData.max_energy && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-cyan-400/70">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Відновлення до наступної енергії
                    </span>
                    <span className="font-mono font-bold">{timeToNextEnergy}</span>
                  </div>
                  <div className="h-2 bg-gray-900/30 rounded-full overflow-hidden border border-cyan-500/20">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-cyan-500 transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      style={{ width: `${energyRegenProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tap button */}
            <div className="flex flex-col items-center">
              <div 
                className="relative w-48 h-48 sm:w-64 sm:h-64 cursor-pointer active:scale-95 transition-transform"
                onClick={handleManualClick}
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-3xl opacity-50 animate-pulse" />
                
                {/* Main circle */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 rounded-full shadow-2xl border-4 border-white/20 flex items-center justify-center hover:scale-105 transition-transform">
                  {/* Inner glow */}
                  <div className="absolute inset-4 bg-gradient-to-br from-purple-400/50 to-pink-400/50 rounded-full animate-pulse" />
                  
                  {/* Bot icon */}
                  <div className="relative animate-bounce">
                    <Gem className="w-24 h-24 sm:w-32 sm:h-32 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
                  </div>
                </div>

                {/* Floating coins */}
                {clickCoins.map(coin => (
                  <div
                    key={coin.id}
                    className="absolute text-4xl font-black text-yellow-400 pointer-events-none animate-float-up drop-shadow-[0_0_10px_rgba(250,204,21,1)]"
                    style={{ 
                      left: coin.x - 32, 
                      top: coin.y - 32,
                      textShadow: '0 0 20px rgba(250,204,21,1), 0 0 40px rgba(250,204,21,0.5)'
                    }}
                  >
                    +{coin.coins}
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-4 sm:mt-6 text-center space-y-1 sm:space-y-2">
                <p className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
                  +{userData?.coins_per_click || 1} за тап
                </p>
                <p className="text-xs sm:text-sm text-cyan-400">
                  💫 Відновлення: 1 енергія / 10 хв
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <Bot className="w-8 h-8 text-primary animate-pulse" />
              Майнер Боти
            </h1>
            <p className="text-muted-foreground mt-1">
              Купуй та прокачуй ботів для заробітку монет
            </p>
          </div>
          <Award className="w-12 h-12 text-yellow-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <div className="flex items-center gap-3">
              <span className="text-yellow-500 font-bold text-4xl">₴</span>
              <div>
                <p className="text-xs text-muted-foreground">Бонусний баланс</p>
                <p className="text-2xl font-bold">
                  <BonusBalanceDisplay 
                    amount={userProfile?.bonus_balance || 0} 
                    iconSize={20}
                  />
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">За годину</p>
                <p className="text-2xl font-bold">
                  <BonusBalanceDisplay amount={totalEarningsPerHour} iconSize={20} showIcon={false} />
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
            <div className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Всього зібрано</p>
                <p className="text-2xl font-bold">
                  <BonusBalanceDisplay amount={userData?.total_earned || 0} iconSize={20} showIcon={false} />
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ботів</p>
                <p className="text-2xl font-bold">{totalMinersOwned}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
          <Button
            onClick={() => setShowDailyRewards(true)}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/10"
          >
            <Gift className="w-6 h-6 text-primary" />
            <span className="font-semibold text-sm">Щоденна винагорода</span>
          </Button>
          
          <Button
            onClick={() => setShowAchievements(true)}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2 hover:bg-yellow-500/10"
          >
            <Trophy className="w-6 h-6 text-yellow-500" />
            <span className="font-semibold text-sm">Досягнення</span>
          </Button>

          <Button
            onClick={() => {
              if (!userProfile?.is_vip) {
                toast({
                  title: "Автозбір доступний тільки для VIP",
                  description: "Оформіть VIP підписку для активації",
                  variant: "destructive",
                });
                return;
              }
              setShowAutoCollect(true);
            }}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2 hover:bg-purple-500/10 relative"
          >
            <Zap className="w-6 h-6 text-purple-500" />
            <span className="font-semibold text-sm">Автозбір</span>
            {!userProfile?.is_vip && (
              <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5">
                VIP
              </Badge>
            )}
            {userData?.auto_collect_enabled && userProfile?.is_vip && (
              <Badge className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5">
                ON
              </Badge>
            )}
          </Button>
        </div>

        {/* Claim Button */}
        <Card className="mt-6 p-6 bg-gradient-to-r from-primary/20 to-purple-500/20 border-2 border-primary/50">
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                <span>Накопичення</span>
                <span>
                  {(() => {
                    const lastClaim = new Date(userData?.last_claim || new Date()).getTime();
                    const now = Date.now();
                    const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
                    const cappedHours = Math.min(hoursPassed, 6);
                    const hours = Math.floor(cappedHours);
                    const minutes = Math.floor((cappedHours - hours) * 60);
                    return `${hours}г ${minutes}хв / 6г`;
                  })()}
                </span>
              </div>
              <div className="h-3 sm:h-4 bg-gray-900/50 rounded-full overflow-hidden border-2 border-primary/30">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000 shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                  style={{ 
                    width: `${(() => {
                      const lastClaim = new Date(userData?.last_claim || new Date()).getTime();
                      const now = Date.now();
                      const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
                      return Math.min((hoursPassed / 6) * 100, 100);
                    })()}%` 
                  }}
                />
              </div>
              {(() => {
                const lastClaim = new Date(userData?.last_claim || new Date()).getTime();
                const now = Date.now();
                const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
                if (hoursPassed >= 6) {
                  return (
                    <p className="text-xs sm:text-sm text-orange-500 font-semibold text-center flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Сховище переповнене! Зберіть монети
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            {/* Claim Section */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Доступно для збору</p>
                <p className="text-2xl sm:text-4xl font-bold text-primary flex items-center gap-2">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse" />
                  <BonusBalanceDisplay amount={pendingEarnings} iconSize={24} showIcon={false} />
                </p>
              </div>
              <Button
                onClick={() => claimEarnings(false)}
                disabled={claiming || pendingEarnings === 0}
                size="lg"
                className="bg-gradient-primary text-white hover:opacity-90 px-4 sm:px-8 py-4 sm:py-6 text-base sm:text-lg"
              >
                {claiming ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Збирання...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 sm:w-6 sm:h-6" />
                    Зібрати
                  </div>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-12 sm:h-14 text-xs sm:text-sm">
          <TabsTrigger value="mine" className="text-sm sm:text-lg">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Майнінг</span>
            <span className="sm:hidden">Мін</span>
          </TabsTrigger>
          <TabsTrigger value="shop" className="text-sm sm:text-lg">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Магазин</span>
            <span className="sm:hidden">Маг</span>
          </TabsTrigger>
          <TabsTrigger value="upgrade" className="text-sm sm:text-lg">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Покращення</span>
            <span className="sm:hidden">Пок</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="text-sm sm:text-lg">
            <Archive className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Сховище</span>
            <span className="sm:hidden">Схов</span>
          </TabsTrigger>
        </TabsList>

        {/* Mining Tab */}
        <TabsContent value="mine" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              Мої Майнери
            </h2>
            
            {totalMinersOwned === 0 ? (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">
                  У вас ще немає ботів. Купіть першого у магазині!
                </p>
                <Button 
                  onClick={() => setSelectedTab("shop")} 
                  className="mt-4 bg-gradient-primary"
                  size="lg"
                >
                  Перейти до магазину
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {miners.filter(m => m.owned > 0).map((miner) => (
                  <Card 
                    key={miner.id}
                    className="p-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-2 border-primary/30 hover:border-primary/60 transition-all"
                  >
                    <div className="text-center">
                      <div className="mb-3 flex justify-center">
                        {(() => {
                          const IconComponent = getMinerIcon(miner.image);
                          return <IconComponent className="w-16 h-16 text-primary animate-pulse" />;
                        })()}
                      </div>
                      <h3 className="font-bold text-lg mb-2">{miner.name}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Рівень:</span>
                          <span className="font-bold text-primary">
                            {miner.level} / {miner.max_level}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Кількість:</span>
                          <span className="font-bold">{miner.owned}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Заробіток:</span>
                          <span className="font-bold text-green-500">
                            {(miner.earnings_per_hour * miner.owned).toLocaleString()}/год
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={(miner.level / miner.max_level) * 100} 
                        className="mt-4"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Shop Tab */}
        <TabsContent value="shop" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Магазин Ботів
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {miners.map((miner) => (
                <Card 
                  key={miner.id}
                  className={cn(
                    "group p-6 transition-all hover:scale-105 hover:shadow-glow cursor-pointer relative overflow-hidden",
                    miner.owned > 0 
                      ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/50"
                      : "bg-gradient-to-br from-slate-500/5 to-slate-500/10 border-2 border-border/30"
                  )}
                >
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  
                  <div className="text-center relative z-10">
                    <div className="mb-3 flex justify-center">
                      {(() => {
                        const IconComponent = getMinerIcon(miner.image);
                        return <IconComponent className="w-20 h-20 text-primary animate-pulse" />;
                      })()}
                    </div>
                    <h3 className="font-bold text-xl mb-2">{miner.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {miner.description}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Дохід:</span>
                        <span className="font-bold flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <BonusBalanceDisplay amount={miner.earnings_per_hour} iconSize={14} showIcon={false} />/год
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Ціна:</span>
                        <span className="font-bold flex items-center gap-1">
                          <BonusBalanceDisplay amount={miner.cost} iconSize={16} />
                        </span>
                      </div>
                      {miner.owned > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">У власності:</span>
                          <span className="font-bold">{miner.owned}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => buyMiner(miner.id)}
                      disabled={userProfile && userProfile.bonus_balance < miner.cost}
                      className="w-full bg-gradient-primary hover:opacity-90"
                      size="lg"
                    >
                      {userProfile && userProfile.bonus_balance < miner.cost ? (
                        "Недостатньо коштів"
                      ) : (
                        <span className="flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5" />
                          Купити
                        </span>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Upgrade Tab */}
        <TabsContent value="upgrade" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Rocket className="w-6 h-6 text-purple-500" />
              Покращення Ботів
            </h2>
            
            {totalMinersOwned === 0 ? (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg">
                  Спочатку купіть ботів для покращення
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {miners.filter(m => m.owned > 0).map((miner) => {
                  const baseCost = MINER_BOTS.find(m => m.id === miner.id)?.cost || miner.cost;
                  const baseEarnings = MINER_BOTS.find(m => m.id === miner.id)?.earnings_per_hour || miner.earnings_per_hour;
                  const upgradeCost = Math.floor(baseCost * Math.pow(minerConfig.bot_upgrade_cost_multiplier, miner.level));
                  const canUpgrade = miner.level < miner.max_level;
                  const newEarnings = Math.floor(baseEarnings * Math.pow(minerConfig.bot_level_earning_multiplier, miner.level));

                  return (
                    <Card 
                      key={miner.id}
                      className="group p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 hover:border-purple-500/60 transition-all relative overflow-hidden"
                    >
                      {/* Sparkle effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      
                      <div className="text-center relative z-10">
                        <div className="mb-3 flex justify-center">
                          {(() => {
                            const IconComponent = getMinerIcon(miner.image);
                            return <IconComponent className="w-16 h-16 text-primary animate-pulse" />;
                          })()}
                        </div>
                        <h3 className="font-bold text-lg mb-2">{miner.name}</h3>
                        
                        <div className="space-y-3 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Рівень</p>
                            <p className="text-xl font-bold text-primary">
                              {miner.level} / {miner.max_level}
                            </p>
                            <Progress 
                              value={(miner.level / miner.max_level) * 100} 
                              className="mt-2"
                            />
                          </div>

                          <div className="pt-3 border-t border-border/30">
                            <p className="text-xs text-muted-foreground mb-2">
                              Після покращення:
                            </p>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Дохід:</span>
                              <span className="font-bold text-green-500">
                                {miner.earnings_per_hour.toLocaleString()} → {newEarnings.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {canUpgrade && (
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-border/30">
                              <span className="text-muted-foreground">Вартість:</span>
                              <span className="font-bold text-yellow-500 flex items-center gap-1">
                                <Coins className="w-4 h-4" />
                                {upgradeCost.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => upgradeMiner(miner.id)}
                          disabled={!canUpgrade || (userProfile && userProfile.bonus_balance < upgradeCost)}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                          size="lg"
                        >
                          {!canUpgrade ? (
                            <span className="flex items-center gap-2">
                              <Star className="w-5 h-5" />
                              Макс. рівень
                            </span>
                          ) : userProfile && userProfile.bonus_balance < upgradeCost ? (
                            "Недостатньо коштів"
                          ) : (
                            <span className="flex items-center gap-2">
                              <Rocket className="w-5 h-5" />
                              Покращити
                            </span>
                          )}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="space-y-4">
          <StorageUpgrade
            storageLevel={userData?.storage_level || 1}
            storageMaxHours={userData?.storage_max_hours || 6}
            userBalance={userProfile?.bonus_balance || 0}
            onUpgrade={loadUserData}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DailyRewards 
        open={showDailyRewards} 
        onOpenChange={setShowDailyRewards}
        onRewardClaimed={loadUserData}
      />
      
      <Achievements 
        open={showAchievements} 
        onOpenChange={setShowAchievements}
      />

      <AutoCollectSettings
        open={showAutoCollect}
        onOpenChange={setShowAutoCollect}
        autoCollectEnabled={userData?.auto_collect_enabled || false}
        autoCollectLevel={userData?.auto_collect_level || 1}
        userBalance={userProfile?.bonus_balance || 0}
        onUpdate={loadUserData}
        isVip={userProfile?.is_vip}
      />
      </div>
    </div>
  );
};

export default MinerGame;
