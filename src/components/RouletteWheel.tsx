import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { User } from "@supabase/supabase-js";
import { BonusBalanceDisplay } from "./BonusBalanceDisplay";
import { Play, Clock, TrendingUp, Gift, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RouletteWheelProps {
  user: User;
  onBalanceUpdate?: () => void;
  currentBalance?: number;
  freeSpins?: number;
}

interface WheelSpin {
  id: string;
  prize_amount: number;
  created_at: string;
}

const DEFAULT_PRIZES = [
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
];

const DEFAULT_COOLDOWN_HOURS = 3;
const DEFAULT_SPIN_DURATION = 5000;

export const RouletteWheel = ({ user, onBalanceUpdate, currentBalance = 0, freeSpins = 0 }: RouletteWheelProps) => {
  const { toast } = useToast();
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastSpin, setLastSpin] = useState<Date | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState("");
  const [history, setHistory] = useState<WheelSpin[]>([]);
  const [currentPrize, setCurrentPrize] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [prizes, setPrizes] = useState(DEFAULT_PRIZES);
  const [cooldownHours, setCooldownHours] = useState(DEFAULT_COOLDOWN_HOURS);
  const [spinDuration, setSpinDuration] = useState(DEFAULT_SPIN_DURATION);
  const [spinAudio, setSpinAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize spin sound
    const audio = new Audio('/sounds/roulette-spin.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    setSpinAudio(audio);

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    loadLastSpin();
    loadHistory();
    checkVipStatus();
    loadRouletteSettings();
  }, [user.id]);

  const loadRouletteSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "roulette_config")
        .single();

      if (data && !error) {
        const config = data.value as any;
        if (config.prizes && Array.isArray(config.prizes)) {
          setPrizes(config.prizes);
        }
        if (config.cooldown_hours) {
          setCooldownHours(config.cooldown_hours);
        }
        if (config.spin_duration) {
          setSpinDuration(config.spin_duration);
        }
      }
    } catch (error) {
      console.error("Error loading roulette settings:", error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      updateCooldown();
    }, 1000);

    return () => clearInterval(timer);
  }, [lastSpin]);

  const loadLastSpin = async () => {
    try {
      const { data, error } = await supabase
        .from("wheel_spins")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLastSpin(new Date(data.created_at));
      } else {
        setCanSpin(true);
      }
    } catch (error) {
      console.error("Error loading last spin:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("wheel_spins")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const checkVipStatus = async () => {
    try {
      const { data } = await supabase
        .from("vip_subscriptions")
        .select("expires_at")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .single();

      setIsVip(!!data);
    } catch (error) {
      console.error("Error checking VIP status:", error);
      setIsVip(false);
    }
  };

  const updateCooldown = () => {
    // If user has free spins, they can always spin
    if (freeSpins > 0) {
      setCanSpin(true);
      setTimeUntilNext("");
      return;
    }

    if (!lastSpin) {
      setCanSpin(true);
      setTimeUntilNext("");
      return;
    }

    const now = new Date();
    const nextSpin = new Date(lastSpin.getTime() + cooldownHours * 60 * 60 * 1000);
    const diff = nextSpin.getTime() - now.getTime();

    if (diff <= 0) {
      setCanSpin(true);
      setTimeUntilNext("");
    } else {
      setCanSpin(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeUntilNext(`${hours}г ${minutes}хв ${seconds}с`);
    }
  };

  const selectPrize = () => {
    const random = Math.random();
    let cumulative = 0;

    console.log('🎰 Roulette spin - random value:', random);

    for (const prize of prizes) {
      cumulative += prize.probability;
      if (random < cumulative) {
        console.log(`🎯 Prize selected: ${prize.amount}₴ (probability: ${prize.probability}, cumulative: ${cumulative})`);
        return prize.amount;
      }
    }

    // Fallback to last prize if something goes wrong
    console.log('⚠️ Fallback to last prize');
    return prizes[prizes.length - 1].amount;
  };

  const playWinSound = (prize: number) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Determine sound complexity based on prize tier
      if (prize <= 5) {
        // Small prize: Simple pleasant chime
        playSimpleChime(audioContext);
      } else if (prize <= 10) {
        // Medium prize: Exciting melody
        playMediumWin(audioContext);
      } else if (prize <= 15) {
        // Large prize: Very exciting sound
        playLargeWin(audioContext);
      } else {
        // Jackpot: Spectacular fanfare
        playJackpot(audioContext);
      }
    } catch (err) {
      console.log('Win sound play failed:', err);
    }
  };

  const playSimpleChime = (audioContext: AudioContext) => {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.5);
      
      osc.start(audioContext.currentTime + i * 0.15);
      osc.stop(audioContext.currentTime + i * 0.15 + 0.5);
    });
  };

  const playMediumWin = (audioContext: AudioContext) => {
    const melody = [
      { freq: 523.25, time: 0 },    // C5
      { freq: 659.25, time: 0.1 },  // E5
      { freq: 783.99, time: 0.2 },  // G5
      { freq: 1046.50, time: 0.3 }, // C6
    ];
    
    melody.forEach(({ freq, time }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      osc.type = 'triangle';
      
      gain.gain.setValueAtTime(0.25, audioContext.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.4);
      
      osc.start(audioContext.currentTime + time);
      osc.stop(audioContext.currentTime + time + 0.4);
    });
  };

  const playLargeWin = (audioContext: AudioContext) => {
    const melody = [
      { freq: 523.25, time: 0 },    // C5
      { freq: 659.25, time: 0.08 }, // E5
      { freq: 783.99, time: 0.16 }, // G5
      { freq: 1046.50, time: 0.24 },// C6
      { freq: 1318.51, time: 0.32 },// E6
      { freq: 1046.50, time: 0.4 }, // C6
    ];
    
    melody.forEach(({ freq, time }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      osc.type = 'square';
      
      filter.type = 'lowpass';
      filter.frequency.value = freq * 2;
      
      gain.gain.setValueAtTime(0.2, audioContext.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.35);
      
      osc.start(audioContext.currentTime + time);
      osc.stop(audioContext.currentTime + time + 0.35);
    });
  };

  const playJackpot = (audioContext: AudioContext) => {
    // Triumphant fanfare
    const fanfare = [
      { freq: 523.25, time: 0 },    // C5
      { freq: 659.25, time: 0.06 }, // E5
      { freq: 783.99, time: 0.12 }, // G5
      { freq: 1046.50, time: 0.18 },// C6
      { freq: 783.99, time: 0.24 }, // G5
      { freq: 1046.50, time: 0.3 }, // C6
      { freq: 1318.51, time: 0.36 },// E6
      { freq: 1568.00, time: 0.42 },// G6
    ];
    
    fanfare.forEach(({ freq, time }) => {
      // Main melody
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sawtooth';
      
      gain.gain.setValueAtTime(0.15, audioContext.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.4);
      
      osc.start(audioContext.currentTime + time);
      osc.stop(audioContext.currentTime + time + 0.4);
      
      // Harmony
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = freq * 1.5; // Perfect fifth
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.1, audioContext.currentTime + time);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.4);
      
      osc2.start(audioContext.currentTime + time);
      osc2.stop(audioContext.currentTime + time + 0.4);
    });
  };

  const spinWheel = async () => {
    if (isSpinning) {
      console.log('Already spinning, ignoring request');
      return;
    }

    // Check if user can spin (either has free spins or cooldown expired)
    if (freeSpins === 0 && !canSpin) {
      toast({
        title: "Зачекайте",
        description: `Наступне обертання буде доступне через ${timeUntilNext}`,
        variant: "destructive",
      });
      return;
    }

    console.log('Starting spin, setting isSpinning=true');
    setIsSpinning(true);
    setCanSpin(false); // Immediately disable button
    setIsPlaying(true);
    
    // Play spin sound
    if (spinAudio) {
      spinAudio.currentTime = 0;
      spinAudio.play().catch(err => console.log('Audio play failed:', err));
    }
    
    const basePrize = selectPrize();
    const finalPrize = isVip ? basePrize * 2 : basePrize;
    
    console.log('Starting spin, current rotation:', rotation);
    
    // Animate wheel with more exciting animation
    const spins = 10 + Math.random() * 4;
    const prizeIndex = prizes.findIndex(p => p.amount === basePrize);
    const anglePerSlice = 360 / prizes.length;
    
    // Calculate target angle so pointer points to center of the prize
    // Pointer is at top (0 degrees), we need to rotate wheel so prize is under pointer
    const targetAngle = -((prizeIndex * anglePerSlice) + (anglePerSlice / 2));
    const finalRotation = rotation + 360 * spins + targetAngle;
    
    console.log('Prize Index:', prizeIndex, 'Base Prize:', basePrize, 'Final Prize:', finalPrize);
    console.log('Target Angle:', targetAngle, 'Final Rotation:', finalRotation);
    
    // Force re-render by using requestAnimationFrame
    requestAnimationFrame(() => {
      setRotation(finalRotation);
    });

    // Stop sound after spin duration
    setTimeout(() => {
      setIsPlaying(false);
      if (spinAudio) {
        spinAudio.pause();
        spinAudio.currentTime = 0;
      }
    }, spinDuration);

    setTimeout(async () => {
      setCurrentPrize(finalPrize);
      playWinSound(finalPrize);

      try {
        // Add spin to history
        const { error: spinError } = await supabase
          .from("wheel_spins")
          .insert({
            user_id: user.id,
            prize_amount: finalPrize,
          });

        if (spinError) throw spinError;

        // Update bonus balance
        const { data: profileData, error: fetchError } = await supabase
          .from("profiles")
          .select("bonus_balance")
          .eq("id", user.id)
          .single();

        if (fetchError) throw fetchError;

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({
            bonus_balance: (profileData.bonus_balance || 0) + finalPrize,
          })
          .eq("id", user.id);

        // Add transaction for bonus
        const { error: transactionError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            type: "bonus",
            amount: finalPrize,
            description: isVip 
              ? `Виграш у рулетці (VIP бонус x2: ${basePrize}₴ → ${finalPrize}₴)`
              : `Виграш у рулетці`,
            status: "completed",
            metadata: {
              prize_amount: finalPrize,
              base_prize: basePrize,
              is_vip: isVip,
              vip_multiplier: isVip ? 2 : 1,
              source: "roulette"
            }
          });

        if (transactionError) {
          console.error("Transaction error:", transactionError);
        }

        toast({
          title: "Вітаємо!",
          description: isVip 
            ? `Ви виграли ${finalPrize}₴ бонусів! (VIP бонус x2)` 
            : `Ви виграли ${finalPrize}₴ бонусів!`,
          duration: 5000,
        });

        // If this was a free spin, decrease the count
        if (freeSpins > 0) {
          const { error: freeSpinError } = await supabase
            .from("free_spins")
            .update({ 
              spins_count: Math.max(0, freeSpins - 1),
              updated_at: new Date().toISOString()
            })
            .eq("user_id", user.id);

          if (freeSpinError) {
            console.error("Error updating free spins:", freeSpinError);
          }
        } else {
          // Regular spin - set last spin time and disable spinning immediately
          const now = new Date();
          setLastSpin(now);
          setCanSpin(false);
        }

        loadHistory();
        onBalanceUpdate?.();
      } catch (error: any) {
        console.error("Error spinning wheel:", error);
        toast({
          title: "Помилка",
          description: "Не вдалося прокрутити рулетку",
          variant: "destructive",
        });
        setCanSpin(true); // Re-enable if error
      } finally {
        console.log('Spin complete, setting isSpinning=false');
        setIsSpinning(false);
        setIsPlaying(false);
        setTimeout(() => setCurrentPrize(null), 3000);
      }
    }, 8000); // Changed to 8000ms to match animation duration
  };

  return (
    <div className="space-y-6">
      {/* Wheel Card */}
      <Card className="glass-effect border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Рулетка удачі
          </CardTitle>
          {isVip && (
            <div className="mt-2 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="text-yellow-500 font-bold text-lg">VIP</span>
                <span className="text-sm text-foreground">
                  Ваші призи збільшені вдвічі!
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="flex justify-center">
            <div className="px-6 py-3 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Бонусний баланс:</span>
                <span className="text-2xl font-bold">
                  <BonusBalanceDisplay amount={currentBalance} iconSize={24} />
                </span>
              </div>
            </div>
          </div>

          {/* Wheel */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-80 h-80">
              {/* Outer golden ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-2xl animate-pulse" style={{ animationDuration: '3s' }}></div>
              
              {/* Inner shadow ring */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 shadow-inner"></div>
              
              {/* Wheel container with proper animation */}
              <div
                className="absolute inset-4 rounded-full overflow-hidden shadow-2xl"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  boxShadow: '0 0 50px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.3)',
                  transition: isSpinning 
                    ? `transform ${spinDuration / 1000}s cubic-bezier(0.15, 0.7, 0.1, 1)` 
                    : 'transform 0.5s ease-out',
                  willChange: 'transform'
                }}
              >
                {prizes.map((prize, index) => {
                  const angle = (360 / prizes.length);
                  const prizeRotation = angle * index;
                  
                  return (
                    <div
                      key={prize.amount}
                      className={`absolute inset-0 bg-gradient-to-br ${prize.gradient}`}
                      style={{
                        clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((prizeRotation - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((prizeRotation - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((prizeRotation + angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((prizeRotation + angle - 90) * Math.PI / 180)}%)`,
                      }}
                    >
                      {/* Prize display - gift icon */}
                      <div
                        className="absolute flex flex-col items-center justify-center"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: `translate(-50%, -50%) rotate(${prizeRotation + angle / 2}deg) translateY(-100px)`,
                          width: '80px',
                        }}
                      >
                        <Gift className="w-8 h-8 text-white drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }} />
                      </div>
                      
                      {/* Shine effect */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((prizeRotation - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((prizeRotation - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((prizeRotation + angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((prizeRotation + angle - 90) * Math.PI / 180)}%)`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Center circle with enhanced styling */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-2xl flex items-center justify-center border-4 border-white/30">
                <div className="w-16 h-16 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center animate-pulse" style={{ animationDuration: '2s' }}>
                  <Gift className="w-8 h-8 text-primary-foreground drop-shadow-lg" />
                </div>
              </div>
              
              {/* Pointer with enhanced styling */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 z-10">
                <div className="relative">
                  <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-primary drop-shadow-2xl"></div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[32px] border-t-primary-glow"></div>
                </div>
              </div>
              
              {/* Decorative dots around the wheel */}
              {[...Array(12)].map((_, i) => {
                const dotAngle = (i * 30) * Math.PI / 180;
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-full bg-yellow-400 shadow-glow animate-pulse"
                    style={{
                      top: `${50 - 45 * Math.sin(dotAngle)}%`,
                      left: `${50 + 45 * Math.cos(dotAngle)}%`,
                      transform: 'translate(-50%, -50%)',
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '2s',
                    }}
                  />
                );
              })}
            </div>

            {currentPrize && (
              <div className="text-center animate-scale-in">
                <p className="text-5xl font-bold text-primary mb-2 drop-shadow-lg animate-pulse">
                  +<BonusBalanceDisplay 
                    amount={currentPrize} 
                    iconSize={20} 
                    showIcon={false}
                  />
                </p>
                {isVip && (
                  <p className="text-yellow-500 font-semibold text-lg mb-1 flex items-center gap-1 justify-center">
                    <Star className="w-4 h-4 fill-yellow-500" /> VIP бонус x2!
                  </p>
                )}
                <p className="text-muted-foreground text-lg">Додано до бонусного балансу!</p>
              </div>
            )}
          </div>

          {/* Spin Button */}
          <div className="text-center space-y-3">
            {(canSpin || freeSpins > 0) && !isSpinning && (
              <Button
                onClick={spinWheel}
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow w-full sm:w-auto"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                {freeSpins > 0 ? `Крутити (${freeSpins} безкоштовних)` : "Крутити рулетку"}
              </Button>
            )}

            {freeSpins === 0 && !canSpin && timeUntilNext && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Наступна спроба через: {timeUntilNext}</span>
              </div>
            )}

            {!isSpinning && (canSpin || freeSpins > 0) && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                {freeSpins > 0 ? `${freeSpins} безкоштовних обертів` : 'Доступно'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5" />
            Історія виграшів
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Поки що немає виграшів</p>
            ) : (
              <div className="space-y-2">
                {history.map((spin) => (
                  <div
                    key={spin.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Gift className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          +<BonusBalanceDisplay 
                            amount={spin.prize_amount} 
                            iconSize={16} 
                            showIcon={false}
                          />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(spin.created_at).toLocaleString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
