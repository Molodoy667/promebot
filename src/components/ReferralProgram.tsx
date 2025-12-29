import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Users, Coins, TrendingUp, Gift, Sparkles, User } from "lucide-react";

interface ReferralProgramProps {
  userId: string;
  referralCode: string;
}

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  referrals: Array<{
    id: string;
    email: string;
    full_name: string | null;
    created_at: string;
    bonus_amount: number;
  }>;
}

export const ReferralProgram = ({ userId, referralCode }: ReferralProgramProps) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalEarnings: 0,
    referrals: []
  });
  const [loading, setLoading] = useState(true);
  const [referrerBonus, setReferrerBonus] = useState(5);
  const [refereeBonus, setRefereeBonus] = useState(3);
  const [tariffCommission, setTariffCommission] = useState(10);

  // Show referral code instead of link

  useEffect(() => {
    fetchReferralStats();
    loadReferralSettings();

    // Real-time updates for referrals
    const referralsChannel = supabase
      .channel('referrals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referrals',
          filter: `referrer_id=eq.${userId}`,
        },
        () => {
          console.log('Referral changed, refreshing stats...');
          fetchReferralStats();
        }
      )
      .subscribe();

    // Real-time updates for referral settings
    const settingsChannel = supabase
      .channel('referral_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: `key=eq.referral_config`,
        },
        () => {
          console.log('Referral settings changed, reloading...');
          loadReferralSettings();
        }
      )
      .subscribe();

    return () => {
      referralsChannel.unsubscribe();
      settingsChannel.unsubscribe();
    };
  }, [userId]);

  const loadReferralSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "referral_config")
        .single();

      if (data && !error) {
        const config = data.value as any;
        setReferrerBonus(config.referrer_bonus || 5);
        setRefereeBonus(config.referee_bonus || 3);
        setTariffCommission(config.tariff_commission_percent || 10);
      }
    } catch (error) {
      console.error("Error loading referral settings:", error);
    }
  };

  const fetchReferralStats = async () => {
    try {
      console.log("Fetching referral stats for user:", userId);
      // Get all referrals with user details
      const { data: referrals, error: referralsError } = await supabase
        .from("referrals")
        .select(`
          id,
          bonus_amount,
          created_at,
          referred_id,
          profiles!referrals_referred_id_fkey(id, email, full_name, telegram_username, created_at),
          referral_lookup!referrals_referred_id_fkey(full_name, referral_code)
        `)
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      console.log("Referrals data:", referrals, "Error:", referralsError);

      if (referralsError) throw referralsError;

      const totalEarnings = referrals?.reduce((sum, ref) => sum + (ref.bonus_amount || 0), 0) || 0;

      console.log("Total referrals:", referrals?.length, "Total earnings:", totalEarnings);

      setStats({
        totalReferrals: referrals?.length || 0,
        totalEarnings,
        referrals: referrals?.map(ref => {
          const profile = (ref as any).profiles as any;
          const lookup = (ref as any).referral_lookup as any;
          const displayName = profile?.telegram_username || profile?.full_name || lookup?.full_name || lookup?.referral_code || null;
          const displayEmail = profile?.email || lookup?.referral_code || "Невідомий користувач";
          return {
            id: ref.referred_id,
            email: displayEmail,
            full_name: displayName,
            created_at: profile?.created_at || ref.created_at || "",
            bonus_amount: ref.bonus_amount || 0
          };
        }) || []
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({
      title: "Скопійовано!",
      description: "Реферальний код скопійовано в буфер обміну",
    });
  };

  return (
    <Card className="group relative p-8 glass-effect border-border/30 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-slow flex-shrink-0">
            <Gift className="w-7 h-7 text-primary-foreground animate-float" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
              Реферальна програма
              <Sparkles className="w-5 h-5 text-primary animate-spin-slow" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Запрошуйте друзів та отримуйте <span className="font-bold text-warning">{referrerBonus}₴</span> за реєстрацію + <span className="font-bold text-warning">{tariffCommission}%</span> від їх покупок тарифів
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="group/stat p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
            <div className="flex items-center gap-2 text-primary mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover/stat:bg-primary/30 transition-colors">
                <Users className="w-4 h-4 group-hover/stat:scale-110 transition-transform" />
              </div>
              <span className="text-xs font-semibold">Запрошено</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.totalReferrals}</p>
          </div>

          <div className="group/stat p-5 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 hover:border-warning/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
            <div className="flex items-center gap-2 text-warning mb-2">
              <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center group-hover/stat:bg-warning/30 transition-colors">
                <Coins className="w-4 h-4 group-hover/stat:scale-110 transition-transform" />
              </div>
              <span className="text-xs font-semibold">Зароблено</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.totalEarnings.toFixed(2)}₴</p>
          </div>

          <div className="group/stat p-5 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
            <div className="flex items-center gap-2 text-accent mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center group-hover/stat:bg-accent/30 transition-colors">
                <TrendingUp className="w-4 h-4 group-hover/stat:scale-110 transition-transform" />
              </div>
              <span className="text-xs font-semibold">Середній бонус</span>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats.totalReferrals > 0 ? (stats.totalEarnings / stats.totalReferrals).toFixed(2) : "0.00"}₴
            </p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="space-y-3 p-5 rounded-xl bg-gradient-to-br from-background/80 to-background/60 border border-border/50">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Ваше реферальне посилання
          </label>
          <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground mb-2">Ваш реферальний код:</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-3xl font-bold text-primary tracking-wider">
                {referralCode}
              </span>
              <Button 
                onClick={copyReferralCode} 
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-105 gap-2"
              >
                <Copy className="w-4 h-4" />
                Копіювати
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            💡 Поділіться цим кодом зі своїми друзями. Після реєстрації вони введуть код і обидва отримаєте бонуси!
          </p>
        </div>

        {/* Referrals List */}
        {stats.referrals.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Запрошені користувачі
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {stats.referrals.map((referral, index) => (
                <div
                  key={referral.id}
                  className="group/item p-4 rounded-xl bg-gradient-to-br from-background/80 to-background/60 border border-border/50 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:translate-x-1 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover/item:from-primary/30 group-hover/item:to-primary/20 transition-all">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover/item:text-primary transition-colors">
                          {referral.full_name || referral.email}
                        </p>
                        {referral.full_name && (
                          <p className="text-xs text-muted-foreground">{referral.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-br from-warning/10 to-warning/5 px-3 py-1.5 rounded-lg border border-warning/20">
                      <Gift className="w-4 h-4 text-warning" />
                      <p className="text-sm font-bold text-warning">
                        +{referral.bonus_amount.toFixed(2)}₴
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">Зареєстрований:</span>
                    <span>{new Date(referral.created_at).toLocaleDateString("uk-UA", {
                      day: "2-digit",
                      month: "2-digit", 
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
          <h4 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Як це працює?
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2 group/li">
              <span className="text-primary font-bold group-hover/li:scale-125 transition-transform">•</span>
              <span>Надішліть своє посилання друзям</span>
            </li>
            <li className="flex items-start gap-2 group/li">
              <span className="text-primary font-bold group-hover/li:scale-125 transition-transform">•</span>
              <span>Отримайте <span className="font-bold text-warning">{referrerBonus}₴</span> одразу після їх реєстрації</span>
            </li>
            <li className="flex items-start gap-2 group/li">
              <span className="text-primary font-bold group-hover/li:scale-125 transition-transform">•</span>
              <span>Ваш реферал отримає <span className="font-bold text-warning">{refereeBonus}₴</span> на бонусний рахунок</span>
            </li>
            <li className="flex items-start gap-2 group/li">
              <span className="text-primary font-bold group-hover/li:scale-125 transition-transform">•</span>
              <span>Отримуйте <span className="font-bold text-warning">{tariffCommission}%</span> від кожної покупки тарифу вашими рефералами</span>
            </li>
            <li className="flex items-start gap-2 group/li">
              <span className="text-primary font-bold group-hover/li:scale-125 transition-transform">•</span>
              <span>Бонуси зараховуються на бонусний рахунок автоматично</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
};
