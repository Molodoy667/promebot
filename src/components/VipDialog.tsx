import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface VipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentBalance: number;
  onSuccess: () => void;
}

export const VipDialog = ({ open, onOpenChange, userId, currentBalance, onSuccess }: VipDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vip_settings")
        .single();

      if (error) throw error;
      setSettings(data?.value);
    } catch (error) {
      console.error("Error loading VIP settings:", error);
      toast({
        title: "Помилка",
        description: "Помилка завантаження налаштувань VIP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (days: number) => {
    const price = settings?.prices?.[days.toString()];
    if (!price) {
      toast({
        title: "Помилка",
        description: "Ціна не знайдена",
        variant: "destructive",
      });
      return;
    }

    if (currentBalance < price) {
      toast({
        title: "Недостатньо коштів",
        description: "Недостатньо коштів на балансі",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      // Check if user already has VIP
      const { data: existingVip } = await supabase
        .from("vip_subscriptions")
        .select("expires_at")
        .eq("user_id", userId)
        .single();

      if (existingVip) {
        // Extend existing subscription
        const currentExpiry = new Date(existingVip.expires_at);
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + days);

        const { error: updateError } = await supabase
          .from("vip_subscriptions")
          .update({ expires_at: newExpiry.toISOString() })
          .eq("user_id", userId);

        if (updateError) throw updateError;
      } else {
        // Create new subscription
        const { error: insertError } = await supabase
          .from("vip_subscriptions")
          .insert({ user_id: userId, expires_at: expiresAt.toISOString() });

        if (insertError) throw insertError;
      }

      // Deduct balance
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: currentBalance - price })
        .eq("id", userId);

      if (balanceError) throw balanceError;

      // Create transaction
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "vip_purchase",
        amount: -price,
        status: "completed",
        description: `Придбання VIP статусу на ${days} днів`,
        metadata: { days, price },
      });

      // Calculate actual expiry date for toast message
      const finalExpiryDate = existingVip 
        ? new Date(new Date(existingVip.expires_at).getTime() + days * 24 * 60 * 60 * 1000)
        : expiresAt;

      const formattedDate = finalExpiryDate.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Create system notification
      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'system',
        p_title: 'VIP статус придбано',
        p_message: `Ви придбали VIP статус на ${days} ${days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'} за ${price} грн. Оплата списана з вашого основного балансу. Ваш VIP статус буде діяти до ${formattedDate}.`,
        p_link: '/dashboard'
      });

      toast({
        title: "Вітаємо!",
        description: `Ви успішно придбали VIP статус, він буде активний до ${formattedDate}`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error purchasing VIP:", error);
      toast({
        title: "Помилка",
        description: "Помилка придбання VIP статусу",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      loadSettings();
    }

    // Підписка на реал-тайм зміни VIP налаштувань
    const channel = supabase
      .channel('vip_settings_dialog_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.vip_settings',
        },
        () => {
          if (open) {
            loadSettings();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  const packages = [
    { days: 3, popular: false },
    { days: 7, popular: false },
    { days: 14, popular: true },
    { days: 30, popular: false },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] glass-effect border-2 border-amber-500/30 shadow-xl">
        <DialogHeader className="relative">
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-6 w-6 text-amber-500/60" />
          </div>
          <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
            <Crown className="h-7 w-7 text-amber-600" />
            <span className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
              VIP Підписка
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Crown className="h-12 w-12 text-amber-600 animate-pulse mx-auto mb-3" />
            <p className="text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-amber-500/5 backdrop-blur-sm rounded-lg p-4 border border-amber-500/20">
              <p className="text-foreground leading-relaxed text-center">
                {settings?.description || "Отримайте ексклюзивний VIP статус!"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {packages.map(({ days, popular }) => {
                const price = settings?.prices?.[days.toString()] || 0;
                return (
                  <div
                    key={days}
                    className={`relative glass-effect rounded-lg p-3 border transition-all hover:scale-105 ${
                      popular
                        ? "border-amber-500/50 shadow-lg ring-1 ring-amber-500/20"
                        : "border-amber-500/20 hover:border-amber-500/40"
                    }`}
                  >
                    {popular && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        Популярний
                      </div>
                    )}
                    <div className="text-center space-y-2">
                      <div className="relative inline-block">
                        <Crown className="h-6 w-6 text-amber-600 mx-auto" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-lg font-bold text-foreground">{days} днів</p>
                        <p className="text-base font-semibold text-amber-600">{price} грн</p>
                      </div>
                      <Button
                        onClick={() => handlePurchase(days)}
                        disabled={isProcessing || currentBalance < price}
                        size="sm"
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-medium shadow-glow disabled:opacity-50"
                      >
                        {isProcessing ? "Обробка..." : "Придбати"}
                      </Button>
                      {currentBalance < price && (
                        <p className="text-[10px] text-muted-foreground">Недостатньо коштів</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
              <p className="text-sm text-muted-foreground text-center">
                Оплата здійснюється з основного балансу
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

