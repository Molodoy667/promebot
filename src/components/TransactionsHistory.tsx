import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface TransactionsHistoryProps {
  userId: string;
}

export const TransactionsHistory = ({ userId }: TransactionsHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all"); // all, main, bonus

  useEffect(() => {
    loadTransactions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Помилка завантаження транзакцій:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    const incomeTypes = ["deposit", "refund", "bonus", "referral_bonus", "referral_commission", "purchase_bonus", "roulette_win", "task_reward", "reward"];
    
    if (type === "ai_image_generation") {
      return <Sparkles className="w-5 h-5 text-primary" />;
    }
    
    if (incomeTypes.includes(type)) {
      return <ArrowUpCircle className="w-5 h-5 text-success" />;
    }
    return <ArrowDownCircle className="w-5 h-5 text-destructive" />;
  };

  const getTransactionColor = (type: string) => {
    const incomeTypes = ["deposit", "refund", "bonus", "referral_bonus", "referral_commission", "purchase_bonus", "roulette_win", "task_reward", "reward"];
    return incomeTypes.includes(type) ? "text-success" : "text-destructive";
  };

  const getStatusBadge = (status: string, transaction: Transaction) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      completed: { variant: "default", label: "Завершено" },
      pending: { variant: "secondary", label: "В обробці" },
      failed: { variant: "destructive", label: "Помилка" },
      cancelled: { variant: "outline", label: "Скасовано" },
    };

    const config = variants[status] || variants.pending;
    
    // Перевіряємо чи транзакція з бонусного балансу
    const fromBonus = transaction.metadata && typeof transaction.metadata === 'object' && 'from_bonus' in transaction.metadata && transaction.metadata.from_bonus;
    
    // Всі транзакції які стосуються бонусного рахунку
    const bonusTransactionTypes = ['reward', 'referral_bonus', 'referral_commission', 'purchase_bonus', 'roulette_win', 'task_reward', 'bonus'];
    const isBonusTransaction = bonusTransactionTypes.includes(transaction.type) || fromBonus;
    
    return (
      <div className="flex gap-1">
        <Badge variant={config.variant}>{config.label}</Badge>
        {isBonusTransaction && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            Бонус
          </Badge>
        )}
      </div>
    );
  };

  const getTransactionDescription = (transaction: Transaction) => {
    let description = transaction.description || "Транзакція";
    
    // Покупка квитка лотереї
    if (transaction.type === "lottery_ticket") {
      return "Покупка квитка лотереї";
    }
    
    // Виграш у лотереї
    if (transaction.type === "reward" && description.includes("Lottery")) {
      return "Виграш у лотереї";
    }
    
    // Реферальні бонуси та комісії
    if (transaction.type === "referral_bonus" || transaction.type === "referral_commission") {
      return transaction.description;
    }
    
    // Якщо це покупка тарифу, беремо інформацію з metadata, не з description
    if (transaction.type === "tariff_purchase" && transaction.metadata?.payment_type) {
      // Отримуємо назву тарифу з description
      const tariffNameMatch = description.match(/за тариф "(.+?)"/);
      const tariffName = tariffNameMatch ? tariffNameMatch[1] : 'тариф';
      
      const source = transaction.metadata.payment_type === 'bonus' 
        ? 'бонусного балансу' 
        : 'основного балансу';
      
      return `Списання з ${source} за тариф "${tariffName}"`;
    }
    
    // Генерація зображення AI
    if (transaction.type === "ai_image_generation") {
      return transaction.description || "Генерація зображення AI";
    }
    
    return description;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('uk-UA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle>Мої операції</CardTitle>
          <CardDescription>Історія транзакцій</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Фільтрація транзакцій за типом балансу
  const filteredTransactions = transactions.filter(transaction => {
    if (filter === "all") return true;
    
    const bonusTransactionTypes = ['reward', 'referral_bonus', 'referral_commission', 'purchase_bonus', 'roulette_win', 'task_reward', 'bonus'];
    const fromBonus = transaction.metadata && typeof transaction.metadata === 'object' && 'from_bonus' in transaction.metadata && transaction.metadata.from_bonus;
    const isBonusTransaction = bonusTransactionTypes.includes(transaction.type) || fromBonus;
    
    if (filter === "bonus") return isBonusTransaction;
    if (filter === "main") return !isBonusTransaction;
    
    return true;
  });

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Мої операції</CardTitle>
            <CardDescription>
              Історія поповнень та списань (останні 10)
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Тип балансу" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі операції</SelectItem>
              <SelectItem value="main">Основний баланс</SelectItem>
              <SelectItem value="bonus">Бонусний баланс</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Немає операцій</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:bg-accent/5 transition-colors"
                >
                  <div className="mt-1">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm">
                        {getTransactionDescription(transaction)}
                      </p>
                      <p className={`font-bold text-sm whitespace-nowrap ${getTransactionColor(transaction.type)}`}>
                        {["deposit", "refund", "bonus", "referral_bonus", "referral_commission", "purchase_bonus", "roulette_win", "task_reward", "reward"].includes(transaction.type) ? "+" : "-"}
                        {Math.abs(transaction.amount).toFixed(2)} ₴
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(transaction.created_at)}
                      </p>
                      {getStatusBadge(transaction.status, transaction)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
