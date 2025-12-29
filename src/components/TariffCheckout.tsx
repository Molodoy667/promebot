import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, X, Tag, Wallet, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface TariffFeature {
  key: string;
  label: string;
  enabled: boolean;
}

interface Tariff {
  id: string;
  name: string;
  description: string;
  price: number;
  channels_limit: number;
  bots_limit: number;
  posts_per_month: number;
  sources_limit: number;
  duration_days: number | null;
  features_list: TariffFeature[];
}

interface TariffCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  tariff: Tariff | null;
  userBalance: number;
  userBonusBalance: number;
  userId: string;
  onSuccess: () => void;
}

export const TariffCheckout = ({ 
  isOpen, 
  onClose, 
  tariff, 
  userBalance, 
  userBonusBalance,
  userId,
  onSuccess 
}: TariffCheckoutProps) => {
  const { toast } = useToast();
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState<{ percent: number; amount: number } | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoStatus, setPromoStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });
  const [balanceType, setBalanceType] = useState<"main" | "bonus">("main");
  const [isProcessing, setIsProcessing] = useState(false);

  // Real-time validation with debounce
  useEffect(() => {
    if (!tariff) return; // Guard inside useEffect instead of early return
    const validatePromoRealTime = async () => {
      const trimmedCode = promoCode.trim();
      
      // Reset if empty
      if (!trimmedCode) {
        setPromoDiscount(null);
        setPromoStatus({ type: 'idle', message: '' });
        return;
      }

      // Minimum 3 characters to start validation
      if (trimmedCode.length < 3) {
        setPromoStatus({ type: 'idle', message: 'Мінімум 3 символи' });
        setPromoDiscount(null);
        return;
      }

      setPromoValidating(true);
      setPromoStatus({ type: 'idle', message: 'Перевірка...' });

      try {
        const { data, error } = await supabase.rpc('validate_promo_code', {
          p_code: trimmedCode,
          p_tariff_id: tariff.id,
          p_user_id: userId
        });

        if (error) throw error;

        const result = data[0];
        if (result.is_valid) {
          setPromoDiscount({
            percent: result.discount_percent || 0,
            amount: result.discount_amount || 0
          });
          setPromoStatus({ 
            type: 'success', 
            message: `✅ ${result.message}` 
          });
        } else {
          setPromoDiscount(null);
          setPromoStatus({ 
            type: 'error', 
            message: `❌ ${result.message}` 
          });
        }
      } catch (error) {
        console.error("Promo validation error:", error);
        setPromoDiscount(null);
        setPromoStatus({ 
          type: 'error', 
          message: '❌ Помилка перевірки' 
        });
      } finally {
        setPromoValidating(false);
      }
    };

    // Debounce validation - wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      validatePromoRealTime();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [promoCode, tariff?.id, userId]);

  // Early return after all hooks
  if (!tariff) return null;

  const calculateFinalPrice = () => {
    let finalPrice = tariff.price;
    
    if (promoDiscount) {
      if (promoDiscount.percent > 0) {
        finalPrice = finalPrice * (1 - promoDiscount.percent / 100);
      } else if (promoDiscount.amount > 0) {
        finalPrice = Math.max(0, finalPrice - promoDiscount.amount);
      }
    }
    
    return Math.round(finalPrice * 100) / 100;
  };

  const finalPrice = calculateFinalPrice();
  const discount = tariff.price - finalPrice;
  const selectedBalance = balanceType === "main" ? userBalance : userBonusBalance;
  const hasEnoughBalance = selectedBalance >= finalPrice;

  const handlePurchase = async () => {
    if (!hasEnoughBalance) {
      toast({ title: "Недостатньо коштів", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Перевіряємо, чи вже є активний тариф(и)
      // НЕ використовуємо maybeSingle(), бо в БД може бути кілька активних рядків і тоді буде PGRST116
      const { data: activeSubs, error: activeSubsError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'active');

      if (activeSubsError) throw activeSubsError;

      const hadActiveSubscription = (activeSubs?.length ?? 0) > 0;

      // Deactivate ALL active subscriptions if any exist
      if (hadActiveSubscription) {
        const { error: deactivateError } = await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', session.user.id)
          .eq('status', 'active');

        if (deactivateError) throw deactivateError;
      }

      // Deduct balance first
      const { error: balanceError } = await supabase.rpc('deduct_balance', {
        user_id: session.user.id,
        amount: finalPrice,
        balance_type: balanceType
      });

      if (balanceError) throw balanceError;

      // Create subscription
      const startedAt = new Date();
      const expiresAt = tariff.duration_days 
        ? new Date(Date.now() + tariff.duration_days * 24 * 60 * 60 * 1000)
        : null;
      
      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: session.user.id,
        tariff_id: tariff.id,
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt?.toISOString()
      });

      if (subError) throw subError;

      // Create transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount: -finalPrice,
        type: 'tariff_purchase',
        description: `Покупка тарифу: ${tariff.name}`,
        status: 'completed',
        metadata: {
          tariff_id: tariff.id,
          balance_type: balanceType,
          promo_discount: promoDiscount
        }
      });

      if (txError) {
        console.error("Transaction error:", txError);
        // Transaction is non-critical, continue
      }

      // Create system notification about tariff activation / change
      const formattedExpiry = expiresAt
        ? expiresAt.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : null;

      const notificationTitle = hadActiveSubscription
        ? 'Тариф змінено'
        : 'Тариф активовано';

      const notificationMessage = formattedExpiry
        ? hadActiveSubscription
          ? `Ваш тариф "${tariff.name}" змінено. Новий тариф діє до ${formattedExpiry}.`
          : `Ваш тариф "${tariff.name}" активовано. Діє до ${formattedExpiry}.`
        : hadActiveSubscription
          ? `Ваш тариф "${tariff.name}" змінено без обмеження за часом.`
          : `Ваш тариф "${tariff.name}" активовано без обмеження за часом.`;

      await supabase.rpc('create_notification', {
        p_user_id: session.user.id,
        p_type: 'system',
        p_title: notificationTitle,
        p_message: notificationMessage,
        p_link: '/dashboard',
      });

      // Використання промокоду (тільки для розрахунку знижки, без позначення використання в БД)
      // TODO: за потреби додати серверну логіку фіксації використання промокоду

      toast({ title: hadActiveSubscription ? "✅ Тариф успішно змінено!" : "✅ Тариф успішно активовано!" });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Purchase error:", error);
      toast({ title: "Помилка покупки", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3 sm:pb-4">
          <DialogTitle className="text-xl sm:text-2xl font-bold">Чек на оплату</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Перевірте деталі замовлення перед оплатою</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
          {/* Receipt Header */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 sm:p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold text-primary">{tariff.name.charAt(0)}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-1">{tariff.name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{tariff.description}</p>
            </div>
            
            <Separator className="my-3 sm:my-4" />
            
            {/* Receipt Items */}
            <div className="space-y-2 sm:space-y-3 font-mono text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Тариф:</span>
                <span className="font-semibold">{tariff.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Період:</span>
                <span className="font-semibold">
                  {tariff.duration_days ? `${tariff.duration_days} дн.` : 'Необмежено'}
                </span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                <div className="bg-muted/50 p-1.5 sm:p-2 rounded">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1">Каналів</div>
                  <div className="font-bold text-sm sm:text-base">{tariff.channels_limit}</div>
                </div>
                <div className="bg-muted/50 p-1.5 sm:p-2 rounded">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1">Ботів</div>
                  <div className="font-bold text-sm sm:text-base">{tariff.bots_limit}</div>
                </div>
                <div className="bg-muted/50 p-1.5 sm:p-2 rounded">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1">Постів/міс</div>
                  <div className="font-bold text-sm sm:text-base">{tariff.posts_per_month}</div>
                </div>
                <div className="bg-muted/50 p-1.5 sm:p-2 rounded">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1">Джерел</div>
                  <div className="font-bold text-sm sm:text-base">{tariff.sources_limit}</div>
                </div>
              </div>
              
              <Separator className="my-2 sm:my-3" />
              
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-muted-foreground">Ціна тарифу:</span>
                <span className="font-bold">{tariff.price.toFixed(2)} ₴</span>
              </div>
            </div>
          </div>

          {/* Promo code */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
              Промокод (необов'язково)
            </Label>
            <div className="relative">
              <Input 
                placeholder="Введіть промокод..."
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className={`text-sm sm:text-base h-10 sm:h-11 pr-10 ${
                  promoStatus.type === 'success' ? 'border-green-500 focus-visible:ring-green-500' : 
                  promoStatus.type === 'error' ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
              />
              {promoValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {!promoValidating && promoStatus.type === 'success' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              )}
              {!promoValidating && promoStatus.type === 'error' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-5 h-5 text-red-600" />
                </div>
              )}
            </div>
            {promoStatus.message && (
              <p className={`text-xs sm:text-sm font-medium ${
                promoStatus.type === 'success' ? 'text-green-600' : 
                promoStatus.type === 'error' ? 'text-red-600' : 
                'text-muted-foreground'
              }`}>
                {promoStatus.message}
                {promoDiscount && promoStatus.type === 'success' && (
                  <span className="ml-2 font-bold">
                    -{promoDiscount.percent > 0 ? `${promoDiscount.percent}%` : `${promoDiscount.amount} ₴`}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Balance selection */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Оплатити з балансу:</Label>
            <RadioGroup value={balanceType} onValueChange={(v) => setBalanceType(v as "main" | "bonus")}>
              <div className="flex items-center justify-between p-2.5 sm:p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="main" id="main" />
                  <Label htmlFor="main" className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm">
                    <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Основний баланс
                  </Label>
                </div>
                <span className="font-semibold text-xs sm:text-sm">{userBalance.toFixed(2)} ₴</span>
              </div>
              
              <div className="flex items-center justify-between p-2.5 sm:p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="bonus" id="bonus" />
                  <Label htmlFor="bonus" className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm">
                    <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Бонусний баланс
                  </Label>
                </div>
                <span className="font-semibold text-xs sm:text-sm">{userBonusBalance.toFixed(2)} ₴</span>
              </div>
            </RadioGroup>
          </div>

          <Separator className="my-3 sm:my-4" />

          {/* Warning about tariff change */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs text-destructive flex gap-2 items-start">
            <span className="mt-0.5">⚠️</span>
            <p>
              Оформлюючи новий тариф, ви <span className="font-semibold">змінюєте поточний тариф</span>. 
              Ваші <span className="font-semibold">місячні ліміти будуть анульовані</span> та почнуть рахуватись заново для нового тарифу.
            </p>
          </div>

          {/* Total Section - Receipt Style */}
          <div className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 bg-muted/20 font-mono">
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              {discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Початкова ціна:</span>
                    <span className="line-through">{tariff.price.toFixed(2)} ₴</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Знижка {promoCode ? `(${promoCode})` : ''}:</span>
                    <span className="font-semibold">-{discount.toFixed(2)} ₴</span>
                  </div>
                  <Separator className="my-2" />
                </>
              )}
              
              <div className="flex justify-between items-center py-1.5 sm:py-2">
                <span className="text-base sm:text-lg font-bold uppercase">Всього:</span>
                <span className="text-xl sm:text-2xl font-bold text-primary">{finalPrice.toFixed(2)} ₴</span>
              </div>
              
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground pt-1.5 sm:pt-2 border-t">
                <span>Спосіб оплати:</span>
                <span className="font-medium">
                  {balanceType === "main" ? "Основний" : "Бонусний"}
                </span>
              </div>
              
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>Доступно:</span>
                <span className={`font-medium ${!hasEnoughBalance ? 'text-red-500' : 'text-green-600'}`}>
                  {selectedBalance.toFixed(2)} ₴
                </span>
              </div>
            </div>
            
            {!hasEnoughBalance && (
              <div className="mt-2 sm:mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-center">
                <p className="text-[10px] sm:text-xs text-red-600 font-medium">
                  ⚠️ Недостатньо коштів. Потрібно поповнити на {(finalPrice - selectedBalance).toFixed(2)} ₴
                </p>
              </div>
            )}
          </div>

          {/* Actions - Receipt Style */}
          <div className="flex gap-2 sm:gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base"
            >
              Скасувати
            </Button>
            <Button 
              onClick={handlePurchase}
              disabled={!hasEnoughBalance || isProcessing}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base font-semibold bg-gradient-to-r from-primary to-primary/80"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  <span className="hidden sm:inline">Обробка...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Підтвердити оплату</span>
                  <span className="sm:hidden">Оплатити</span>
                </>
              )}
            </Button>
          </div>
          
          <p className="text-[10px] sm:text-xs text-center text-muted-foreground pt-1.5 sm:pt-2">
            Натискаючи "Підтвердити оплату", ви погоджуєтесь з умовами використання
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
