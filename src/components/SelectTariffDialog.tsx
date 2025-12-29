import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Zap, Package, Crown, Wallet, Gift, Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BalanceDisplay } from "./BalanceDisplay";
import { BonusBalanceDisplay } from "./BonusBalanceDisplay";
import { cn } from "@/lib/utils";

interface SelectTariffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

const getTariffIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("базов") || lowerName.includes("basic") || lowerName.includes("starter")) {
    return Package;
  }
  if (lowerName.includes("стандарт") || lowerName.includes("standard") || lowerName.includes("pro")) {
    return Zap;
  }
  if (lowerName.includes("преміум") || lowerName.includes("premium") || lowerName.includes("enterprise")) {
    return Crown;
  }
  return Package;
};

export const SelectTariffDialog = ({ open, onOpenChange, userId, onSuccess }: SelectTariffDialogProps) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTariffId, setSelectedTariffId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTariff, setPendingTariff] = useState<{ id: string; price: number } | null>(null);
  const [paymentType, setPaymentType] = useState<"balance" | "bonus">("balance");

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ["tariffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: activeSubscription } = useQuery({
    queryKey: ["active-subscription", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("balance, bonus_balance")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Real-time updates for tariffs and subscriptions
  useEffect(() => {
    if (!open) return;

    const tariffsChannel = supabase
      .channel('tariffs_dialog_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tariffs',
        },
        () => {
          console.log('Tariffs changed, refreshing...');
          // Will be handled by TanStack Query's refetch
        }
      )
      .subscribe();

    const subscriptionsChannel = supabase
      .channel('subscriptions_dialog_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('Subscription changed, refreshing...');
          // Will be handled by TanStack Query's refetch
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel('profile_dialog_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          console.log('Profile changed, refreshing...');
          // Will be handled by TanStack Query's refetch
        }
      )
      .subscribe();

    return () => {
      tariffsChannel.unsubscribe();
      subscriptionsChannel.unsubscribe();
      profileChannel.unsubscribe();
    };
  }, [open, userId]);

  const handleTariffClick = async (tariffId: string, price: number) => {
    // Визначаємо, чи є активний платний тариф (для підтвердження зміни)
    const currentTariff = tariffs?.find(t => t.id === activeSubscription?.tariff_id);
    const isPaidCurrentTariff = currentTariff && Number((currentTariff as any).price) > 0;

    if (activeSubscription && isPaidCurrentTariff && activeSubscription.tariff_id !== tariffId) {
      // Є активний платний тариф — показуємо підтвердження зміни
      setPendingTariff({ id: tariffId, price });
      setShowConfirmDialog(true);
    } else {
      // Перша покупка або перехід з безкоштовного тарифу — одразу активуємо
      await activateTariff(tariffId, price);
    }
  };

  const activateTariff = async (tariffId: string, price: number) => {
    setSelectedTariffId(tariffId);
    setIsCreating(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance, bonus_balance")
        .eq("id", userId)
        .single();

      if (!profile) {
        toast({
          title: "Помилка",
          description: "Не вдалося завантажити профіль",
          variant: "destructive",
        });
        return;
      }

      // Перевірка чи достатньо коштів на обраному балансі
      let usedBonus = 0;
      let usedBalance = 0;

      if (paymentType === "bonus") {
        if (profile.bonus_balance < price) {
          toast({
            title: "Недостатньо бонусних коштів",
            description: `Для оплати потрібно ${price.toFixed(2)}₴, доступно ${profile.bonus_balance.toFixed(2)}₴`,
            variant: "destructive",
            duration: 2000,
          });
          return;
        }
        usedBonus = price;
      } else {
        if (profile.balance < price) {
          toast({
            title: "Недостатньо коштів",
            description: `Для оплати потрібно ${price.toFixed(2)}₴, доступно ${profile.balance.toFixed(2)}₴`,
            variant: "destructive",
            duration: 2000,
          });
          return;
        }
        usedBalance = price;
      }

      // Отримати дані тарифу для розрахунку дати закінчення
      const { data: tariff } = await supabase
        .from("tariffs")
        .select("duration_days")
        .eq("id", tariffId)
        .single();

      // Деактивувати всі старі підписки
      const { error: deactivateError } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      if (deactivateError) throw deactivateError;

      // Створити нову підписку з датою закінчення на основі duration_days
      const startDate = new Date();
      const expiresAt = new Date();
      
      if (tariff?.duration_days) {
        expiresAt.setDate(expiresAt.getDate() + tariff.duration_days);
      } else {
        // Якщо duration_days не вказано, встановлюємо на 30 днів за замовчуванням
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      const { error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          tariff_id: tariffId,
          status: "active",
          started_at: startDate.toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (subscriptionError) throw subscriptionError;

      // Списати кошти (спочатку бонусний, потім основний)
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ 
          balance: profile.balance - usedBalance,
          bonus_balance: profile.bonus_balance - usedBonus
        })
        .eq("id", userId);

      if (balanceError) throw balanceError;

      // Create transaction for the deduction
      const tariffName = tariffs?.find(t => t.id === tariffId)?.name || 'тариф';
      const balanceType = paymentType === 'bonus' ? "бонусного" : "основного";
      
      console.log('Creating tariff purchase transaction:', {
        user_id: userId,
        type: "tariff_purchase",
        amount: price,
        tariff_id: tariffId,
        tariff_price: price,
        status: "completed"
      });
      
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "tariff_purchase",
          amount: price,
          description: `Списання з ${balanceType} балансу за тариф "${tariffName}"`,
          status: "completed",
          metadata: {
            tariff_id: tariffId,
            tariff_price: price,
            used_bonus: usedBonus,
            used_balance: usedBalance,
            payment_type: paymentType
          }
        })
        .select()
        .single();

      if (transactionError) {
        console.error("Transaction creation error:", transactionError);
        // Don't throw - subscription already created and money deducted
      } else {
        console.log("Transaction created successfully:", transactionData);
      }

      // Нарахувати комісію рефереру якщо є
      try {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", userId)
          .single();

        if (currentProfile?.referred_by) {
          // Отримати налаштування реферальної програми
          const { data: referralConfig } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "referral_config")
            .single();

          const configValue = referralConfig?.value as { tariff_commission_percent?: number } | null;
          const commission = configValue?.tariff_commission_percent || 10;
          const referralBonus = (price * commission) / 100;

          // Додати бонус рефереру
          const { data: referrerProfile } = await supabase
            .from("profiles")
            .select("bonus_balance")
            .eq("id", currentProfile.referred_by)
            .single();

          if (referrerProfile) {
            await supabase
              .from("profiles")
              .update({ 
                bonus_balance: referrerProfile.bonus_balance + referralBonus 
              })
              .eq("id", currentProfile.referred_by);

            // Оновити запис в referrals - використовуємо increment через select-update
            const { data: currentReferral } = await supabase
              .from("referrals")
              .select("bonus_amount")
              .eq("referrer_id", currentProfile.referred_by)
              .eq("referred_id", userId)
              .single();

            if (currentReferral) {
              await supabase
                .from("referrals")
                .update({ 
                  bonus_amount: (currentReferral.bonus_amount || 0) + referralBonus 
                })
                .eq("referrer_id", currentProfile.referred_by)
                .eq("referred_id", userId);
            }

            console.log(`Referral bonus ${referralBonus}₴ added to referrer`);
          }
        }
      } catch (error) {
        console.error("Error processing referral commission:", error);
        // Don't throw - subscription already created
      }

      // Форматуємо дату закінчення
      const formattedDate = expiresAt.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Визначаємо, чи це зміна платного тарифу, щоб показати інший текст
      const previousTariff = tariffs?.find(t => t.id === activeSubscription?.tariff_id);
      const previousIsPaid = previousTariff && Number((previousTariff as any).price) > 0;
      const isTariffChange = !!activeSubscription && activeSubscription.tariff_id !== tariffId && previousIsPaid;

      const newTariffName = tariffName;
      const previousTariffName = previousTariff?.name || "попередній тариф";

      const notificationTitle = isTariffChange ? "Тариф змінено" : "Тариф придбано";
      const notificationMessage = isTariffChange
        ? `Ви змінили тариф з "${previousTariffName}" на "${newTariffName}" за ${price.toFixed(2)} грн. Ваш новий тариф буде діяти до ${formattedDate}.`
        : `Ви придбали тариф "${newTariffName}" за ${price.toFixed(2)} грн. Оплата списана з вашого ${balanceType} балансу. Ваш тариф буде діяти до ${formattedDate}.`;

      // Create system notification
      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'system',
        p_title: notificationTitle,
        p_message: notificationMessage,
        p_link: '/dashboard'
      });

      // Почекаємо трохи щоб тригер встиг спрацювати
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Тариф активовано",
        description: "Ваш тариф успішно активовано!",
        duration: 1500,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error selecting tariff:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося активувати тариф",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsCreating(false);
      setSelectedTariffId(null);
      setPendingTariff(null);
    }
  };

  const handleConfirmTariff = async () => {
    if (!pendingTariff) return;
    setShowConfirmDialog(false);
    await activateTariff(pendingTariff.id, pendingTariff.price);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Оберіть тариф</DialogTitle>
          </DialogHeader>

          {/* Payment Method Selection */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <Label className="text-base font-semibold">Спосіб оплати</Label>
            <RadioGroup value={paymentType} onValueChange={(value: "balance" | "bonus") => setPaymentType(value)}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                <RadioGroupItem value="balance" id="balance" />
                <Label htmlFor="balance" className="flex-1 cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span>Основний баланс</span>
                  </div>
                  <span className="font-semibold">
                    <BalanceDisplay 
                      amount={userProfile?.balance || 0} 
                      iconSize={16}
                    />
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                <RadioGroupItem value="bonus" id="bonus" />
                <Label htmlFor="bonus" className="flex-1 cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-warning" />
                    <span>Бонусний баланс</span>
                  </div>
                  <span className="font-semibold">
                    <BonusBalanceDisplay 
                      amount={userProfile?.bonus_balance || 0} 
                      iconSize={16}
                    />
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {tariffs?.map((tariff) => {
                const features = (tariff.features as string[]) || [];
                const isPopular = tariff.name === "Стандарт" || tariff.name === "Standard";
                const isProcessing = isCreating && selectedTariffId === tariff.id;
                const IconComponent = getTariffIcon(tariff.name);

                return (
                  <Card
                    key={tariff.id}
                    className={cn(
                      "group relative p-6 transition-all duration-500",
                      "bg-gradient-to-br from-card/80 via-card/60 to-card/40",
                      "backdrop-blur-md border-border/50",
                      "hover:scale-[1.02] hover:shadow-2xl hover:border-primary/30",
                      "before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-br before:from-primary/5 before:via-transparent before:to-accent/5",
                      "before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
                      "after:absolute after:inset-0 after:rounded-lg after:bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_70%)]",
                      "after:opacity-0 after:transition-opacity after:duration-500 hover:after:opacity-100",
                      isPopular && "border-primary/50 shadow-glow ring-2 ring-primary/20"
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-gradient-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-glow animate-pulse-slow flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 animate-spin-slow" />
                          Популярний
                          <Sparkles className="w-3 h-3 animate-spin-slow" />
                        </span>
                      </div>
                    )}

                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500",
                          "group-hover:scale-110 group-hover:rotate-3",
                          isPopular 
                            ? "bg-gradient-primary shadow-glow animate-pulse-slow" 
                            : "bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10"
                        )}>
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <IconComponent className={cn(
                            "w-7 h-7 transition-all duration-500 relative z-10",
                            "group-hover:scale-110",
                            isPopular ? "text-primary-foreground animate-float" : "text-primary"
                          )} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold group-hover:text-primary transition-colors duration-300">{tariff.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {tariff.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1 group-hover:scale-105 transition-transform duration-300">
                        <span className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent animate-gradient-slow">{tariff.price}</span>
                        <span className="text-lg text-muted-foreground font-semibold">
                          {tariff.duration_days ? `₴/${tariff.duration_days}д` : '₴/міс'}
                        </span>
                      </div>

                      <ul className="space-y-2.5">
                        {features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2.5 group/item hover:translate-x-1 transition-transform duration-300">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-gradient-primary group-hover/item:scale-110 transition-all duration-300 shadow-sm">
                              <Check className="w-3 h-3 text-primary group-hover/item:text-primary-foreground transition-colors duration-300" />
                            </div>
                            <span className="text-sm font-medium">{feature}</span>
                          </li>
                        ))}
                        
                        <li className="border-t border-border/50 pt-2.5 mt-2.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Доступні функції</p>
                        </li>
                        
                        {[
                          { key: 'allow_media', label: 'Копіювання медіа', enabled: (tariff as any).allow_media ?? true },
                          { key: 'allow_new_posts_only', label: 'Тільки нові пости', enabled: (tariff as any).allow_new_posts_only ?? true },
                          { key: 'allow_keyword_filter', label: 'Фільтр по ключових словах', enabled: (tariff as any).allow_keyword_filter ?? true },
                          { key: 'allow_scheduled_posting', label: 'Відкладена публікація', enabled: (tariff as any).allow_scheduled_posting ?? false },
                          { key: 'allow_post_as_channel', label: 'Публікація від каналу', enabled: (tariff as any).allow_post_as_channel ?? true },
                        ].map((filter) => (
                          <li key={filter.key} className="flex items-start gap-2.5">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              filter.enabled ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                              {filter.enabled ? (
                                <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                              ) : (
                                <X className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <span className={`text-xs ${filter.enabled ? '' : 'text-muted-foreground'}`}>{filter.label}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => handleTariffClick(tariff.id, Number(tariff.price))}
                        disabled={isProcessing}
                        className={cn(
                          "relative w-full transition-all duration-500 font-semibold py-5 overflow-hidden group/btn",
                          "hover:scale-[1.02] hover:shadow-xl",
                          isPopular
                            ? "bg-gradient-primary hover:opacity-90 shadow-glow text-primary-foreground"
                            : "bg-gradient-to-r from-secondary via-secondary to-secondary/80 hover:from-secondary/90 hover:via-secondary hover:to-secondary/70 text-secondary-foreground"
                        )}
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Обробка...
                            </>
                          ) : (
                            <>
                              Обрати тариф
                              <Sparkles className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            </>
                          )}
                        </span>
                        {!isProcessing && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000" />
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Підтвердження зміни тарифу</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Ви дійсно бажаєте змінити свій тариф?</p>
              <p className="text-destructive font-medium">
                З вас буде знято додаткову плату, а попередній тариф буде анульовано.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTariff(null)}>Відхилити</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTariff}>Погодитись</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
