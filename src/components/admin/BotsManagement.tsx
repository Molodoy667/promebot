import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Plus, Edit, Trash2, Check, X, Bot, TestTube2, BarChart3, Loader2, Sparkles, Copy, Users, Radio, FileText, Eye, Zap, Lock, Send } from "lucide-react";
import { UserbotAuthDialog } from "@/components/UserbotAuthDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BotMobileCard } from "./BotMobileCard";
import { SpyMobileCard } from "./SpyMobileCard";
import { SpammerMobileCard } from "./SpammerMobileCard";

interface TelegramBot {
  id: string;
  user_id: string;
  bot_token: string;
  bot_username: string | null;
  bot_name: string | null;
  webhook_url: string | null;
  is_active: boolean;
  status: string;
  posts_count: number;
  channels_count: number;
  last_activity_at: string | null;
  created_at: string;
  bot_type: 'ai' | 'plagiarist' | null;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface TelegramSpy {
  id: string;
  user_id: string;
  api_id: string;
  api_hash: string;
  phone_number: string | null;
  name: string | null;
  is_active: boolean;
  channels_monitored: number;
  last_activity_at: string | null;
  created_at: string;
  session_string: string | null;
  is_authorized: boolean;
  last_error: string | null;
  error_count: number;
}

interface TelegramSpammer {
  id: string;
  user_id: string;
  name: string;
  phone_number: string | null;
  tdata_path: string;
  authkey: string | null;
  is_active: boolean;
  is_authorized: boolean;
  last_activity_at: string | null;
  last_error: string | null;
  error_count: number;
  messages_sent: number;
  created_at: string;
}

export const BotsManagement = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [spies, setSpies] = useState<TelegramSpy[]>([]);
  const [spammers, setSpammers] = useState<TelegramSpammer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isSpyDialogOpen, setIsSpyDialogOpen] = useState(false);
  const [isSpammerDialogOpen, setIsSpammerDialogOpen] = useState(false);
  const [isTestingSpammer, setIsTestingSpammer] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<TelegramBot | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isTestingSpy, setIsTestingSpy] = useState<string | null>(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [selectedSpy, setSelectedSpy] = useState<TelegramSpy | null>(null);
  
  const [formData, setFormData] = useState({
    bot_token: "",
    bot_name: "",
    webhook_url: "",
    bot_type: "plagiarist" as 'ai' | 'plagiarist',
  });

  const [spyFormData, setSpyFormData] = useState({
    api_id: "",
    api_hash: "",
    phone_number: "",
    name: "",
  });

  const [spammerFormData, setSpammerFormData] = useState({
    name: "",
    phone_number: "",
    tdata_file: null as File | null,
    authkey: "",
  });

  useEffect(() => {
    loadBots();
    loadSpies();
    loadSpammers();

    // Real-time updates for telegram bots
    const botsChannel = supabase
      .channel('admin_bots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_bots',
        },
        () => {
          console.log('Bot changed, reloading bots...');
          loadBots();
        }
      )
      .subscribe();

    const spiesChannel = supabase
      .channel('admin_spies_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_spies',
        },
        () => {
          console.log('Spy changed, reloading spies...');
          loadSpies();
        }
      )
      .subscribe();

    const spammersChannel = supabase
      .channel('admin_spammers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_spammers',
        },
        () => {
          console.log('Spammer changed, reloading spammers...');
          loadSpammers();
        }
      )
      .subscribe();

    return () => {
      botsChannel.unsubscribe();
      spiesChannel.unsubscribe();
      spammersChannel.unsubscribe();
    };
  }, []);

  const loadBots = async () => {
    try {
      const { data: botsData, error } = await supabase
        .from("telegram_bots")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Load user profiles
      const userIds = botsData?.map((b) => b.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const botsWithProfiles = botsData?.map((bot) => ({
        ...bot,
        profiles: profiles?.find((p) => p.id === bot.user_id) || null,
      })) || [];

      setBots(botsWithProfiles);
    } catch (error: any) {
      console.error("Error loading bots:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити ботів",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSpies = async () => {
    try {
      const { data, error } = await supabase
        .from("telegram_spies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpies(data || []);
    } catch (error: any) {
      console.error("Error loading spies:", error);
    }
  };

  const loadSpammers = async () => {
    try {
      const { data, error } = await supabase
        .from("telegram_spammers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpammers(data || []);
    } catch (error: any) {
      console.error("Error loading spammers:", error);
    }
  };

  const handleCreateSpy = async () => {
    if (!spyFormData.api_id || !spyFormData.api_hash) {
      toast({
        title: "Помилка",
        description: "Введіть API ID та API Hash",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    try {
      const { error } = await supabase.from("telegram_spies").insert({
        api_id: spyFormData.api_id,
        api_hash: spyFormData.api_hash,
        phone_number: spyFormData.phone_number || null,
        name: spyFormData.name || "Шпигун",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      toast({
        title: "Шпигуна додано",
        description: "Telegram Userbot успішно створено",
        duration: 2000,
      });

      setIsSpyDialogOpen(false);
      setSpyFormData({ api_id: "", api_hash: "", phone_number: "", name: "" });
      await loadSpies();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleDeleteSpy = async (id: string) => {
    try {
      const { error } = await supabase
        .from("telegram_spies")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Шпигуна видалено",
        duration: 1500,
      });

      await loadSpies();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleCreateSpammer = async () => {
    if (!spammerFormData.name || !spammerFormData.tdata_file) {
      toast({
        title: "Помилка",
        description: "Введіть назву та завантажте TData",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    try {
      // TODO: Upload TData file to storage
      // For now, just store the filename
      const tdataPath = `tdata/${Date.now()}_${spammerFormData.tdata_file.name}`;

      const { error } = await supabase.from("telegram_spammers").insert({
        name: spammerFormData.name,
        phone_number: spammerFormData.phone_number || null,
        tdata_path: tdataPath,
        authkey: spammerFormData.authkey || null,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      toast({
        title: "Спамера додано",
        description: "Telegram спамер успішно створено",
        duration: 2000,
      });

      setIsSpammerDialogOpen(false);
      setSpammerFormData({ name: "", phone_number: "", tdata_file: null, authkey: "" });
      await loadSpammers();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleDeleteSpammer = async (id: string) => {
    try {
      const { error } = await supabase
        .from("telegram_spammers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Спамера видалено",
        duration: 1500,
      });

      await loadSpammers();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleTestSpammer = async (spammer: TelegramSpammer) => {
    setIsTestingSpammer(spammer.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("test-spammer", {
        body: { spammerId: spammer.id },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Спамер працює!",
          description: `${spammer.name} готовий до розсилки`,
          duration: 2000,
        });

        await loadSpammers();
      } else {
        toast({
          title: "Помилка тестування",
          description: data.error || "Не вдалося підключитись",
          variant: "destructive",
          duration: 2000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsTestingSpammer(null);
    }
  };

  const openAuthDialog = (spy: TelegramSpy) => {
    setSelectedSpy(spy);
    setIsAuthDialogOpen(true);
  };

  const handleTestSpy = async (spy: TelegramSpy) => {
    // Validate credentials format
    const apiIdValid = /^\d+$/.test(spy.api_id.trim());
    const apiHashValid = /^[a-f0-9]{32}$/i.test(spy.api_hash.trim());

    if (!apiIdValid || !apiHashValid) {
      toast({
        title: "Невірний формат",
        description: "Перевірте API ID (тільки цифри) та API Hash (32 символи)",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Check if already authorized
    if (spy.is_authorized && spy.session_string) {
      toast({
        title: "Шпигун авторизований",
        description: `Шпигун "${spy.name}" готовий до роботи`,
        duration: 3000,
      });
      return;
    }

    // Open authorization dialog
    setSelectedSpy(spy);
    setIsAuthDialogOpen(true);
  };

  const handleTestBot = async (bot: TelegramBot) => {
    setIsTesting(bot.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("test-telegram-bot", {
        body: { bot_token: bot.bot_token },
      });

      if (error) throw error;

      if (data.success) {
        // Set webhook URL automatically
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?bot_token=${bot.bot_token}`;
        
        // Update bot info and webhook
        await supabase
          .from("telegram_bots")
          .update({
            bot_username: data.bot_info.username,
            bot_name: data.bot_info.first_name,
            status: "active",
            is_active: true,
            webhook_url: webhookUrl,
          })
          .eq("id", bot.id);

        // Set webhook on Telegram
        const webhookResponse = await fetch(
          `https://api.telegram.org/bot${bot.bot_token}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ["message", "callback_query", "channel_post"],
            }),
          }
        );

        const webhookResult = await webhookResponse.json();
        console.log("Webhook set result:", webhookResult);

        toast({
          title: "Бот працює!",
          description: `@${data.bot_info.username} - ${data.bot_info.first_name}. Webhook встановлено.`,
          duration: 2000,
        });

        await loadBots();
      } else {
        toast({
          title: "Помилка тестування",
          description: data.error || "Не вдалося підключитись до бота",
          variant: "destructive",
          duration: 1500,
        });
      }
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleCreate = async () => {
    if (!formData.bot_token) {
      toast({
        title: "Помилка",
        description: "Введіть токен бота",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    try {
      // First, test the bot to get its info
      const { data: testData, error: testError } = await supabase.functions.invoke("test-telegram-bot", {
        body: { bot_token: formData.bot_token },
      });

      if (testError) throw testError;
      if (!testData.success) {
        throw new Error(testData.error || "Не вдалося підключитись до бота");
      }

      // Generate webhook URL automatically
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?bot_token=${formData.bot_token}`;
      
      const { error } = await supabase.from("telegram_bots").insert({
        bot_token: formData.bot_token,
        bot_name: formData.bot_name || testData.bot_info.first_name,
        bot_username: testData.bot_info.username,
        webhook_url: webhookUrl,
        status: "active",
        is_active: true,
        bot_type: formData.bot_type,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      // Set webhook on Telegram
      try {
        const webhookResponse = await fetch(
          `https://api.telegram.org/bot${formData.bot_token}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ["message", "callback_query", "channel_post"],
            }),
          }
        );

        const webhookResult = await webhookResponse.json();
        console.log("Webhook set result:", webhookResult);
      } catch (webhookError) {
        console.error("Error setting webhook:", webhookError);
      }

      toast({
        title: "Бот додано",
        description: `@${testData.bot_info.username} успішно створено та налаштовано`,
        duration: 2000,
      });

      setIsCreateDialogOpen(false);
      resetForm();
      await loadBots();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedBot) return;

    try {
      const { error } = await supabase
        .from("telegram_bots")
        .update({
          bot_name: formData.bot_name,
          bot_type: formData.bot_type,
          // webhook_url не оновлюємо, він встановлюється автоматично
        })
        .eq("id", selectedBot.id);

      if (error) throw error;

      toast({
        title: "Бот оновлено",
        description: "Зміни успішно збережено",
        duration: 2000,
      });

      setIsEditDialogOpen(false);
      await loadBots();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleDelete = async (botId: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цього бота?")) return;

    try {
      const { error } = await supabase.from("telegram_bots").delete().eq("id", botId);

      if (error) throw error;

      toast({
        title: "Бот видалено",
        description: "Бот успішно видалено з системи",
        duration: 1500,
      });

      await loadBots();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      bot_token: "",
      bot_name: "",
      webhook_url: "",
      bot_type: "plagiarist",
    });
  };

  const openEditDialog = (bot: TelegramBot) => {
    setSelectedBot(bot);
    setFormData({
      bot_token: bot.bot_token,
      bot_name: bot.bot_name || "",
      webhook_url: bot.webhook_url || "",
      bot_type: bot.bot_type || "plagiarist",
    });
    setIsEditDialogOpen(true);
  };

  const openStatsDialog = (bot: TelegramBot) => {
    setSelectedBot(bot);
    setIsStatsDialogOpen(true);
  };

  const filteredBots = bots.filter(
    (bot) =>
      bot.bot_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bot.bot_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bot.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Bot className="w-8 h-8 animate-pulse text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Завантаження ботів...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Пошук ботів..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Всього ботів: {bots.length}
          </Badge>
          <Button
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className="bg-gradient-primary hover:opacity-90 transition-smooth"
          >
            <Plus className="w-4 h-4 mr-2" />
            Додати бота
          </Button>
        </div>
      </div>

      {/* Desktop - Table View */}
      {!isMobile && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Бот</TableHead>
                  <TableHead className="font-semibold">Категорія</TableHead>
                  <TableHead className="font-semibold">Власник</TableHead>
                  <TableHead className="font-semibold">Статус</TableHead>
                  <TableHead className="font-semibold">Статистика</TableHead>
                  <TableHead className="font-semibold">Остання активність</TableHead>
                  <TableHead className="font-semibold text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Ботів не знайдено" : "Немає доданих ботів"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBots.map((bot) => (
                    <TableRow key={bot.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarImage 
                              src={bot.bot_username ? `https://t.me/i/userpic/320/${bot.bot_username}.jpg` : undefined}
                              alt={bot.bot_name || "Bot"} 
                            />
                            <AvatarFallback className="bg-gradient-primary text-white">
                              <Bot className="w-5 h-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" title={bot.bot_name || bot.bot_username || "Без назви"}>
                                {bot.bot_name || bot.bot_username || "Без назви"}
                              </span>
                            </div>
                            {bot.bot_username && (
                              <span className="text-sm text-muted-foreground">@{bot.bot_username}</span>
                            )}
                            <code className="text-xs text-muted-foreground">
                              ID: {bot.id.slice(0, 8)}...
                            </code>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "gap-1.5",
                            bot.bot_type === 'ai' && "border-primary/30 bg-primary/5 text-primary",
                            (!bot.bot_type || bot.bot_type === 'plagiarist') && "border-secondary/30 bg-secondary/5 text-secondary-foreground"
                          )}
                        >
                          {bot.bot_type === 'ai' ? (
                            <>
                              <Sparkles className="w-3 h-3" />
                              AI
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Плагіатор
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{bot.profiles?.full_name || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {bot.profiles?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {bot.is_active ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <Check className="w-3 h-3 mr-1" />
                            Активний
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <X className="w-3 h-3 mr-1" />
                            Неактивний
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Постів: <span className="font-semibold text-foreground">{bot.posts_count}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Radio className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Каналів: <span className="font-semibold text-foreground">{bot.channels_count}</span>
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {bot.last_activity_at
                          ? new Date(bot.last_activity_at).toLocaleDateString("uk-UA", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestBot(bot)}
                            disabled={isTesting === bot.id}
                          >
                            {isTesting === bot.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <TestTube2 className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openStatsDialog(bot)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(bot)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(bot.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Mobile - Card View */}
      {isMobile && (
        <div className="space-y-3">
          {filteredBots.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              {searchTerm ? "Ботів не знайдено" : "Немає доданих ботів"}
            </Card>
          ) : (
            filteredBots.map((bot) => (
              <BotMobileCard
                key={bot.id}
                bot={bot}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onTest={handleTestBot}
                onStats={openStatsDialog}
                isTesting={isTesting === bot.id}
              />
            ))
          )}
        </div>
      )}

      {/* Spammers Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Send className="w-6 h-6" />
              Telegram Спамери
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Telegram акаунти через TData для масової розсилки
            </p>
          </div>
          <Button onClick={() => setIsSpammerDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Додати спамера
          </Button>
        </div>

        {/* Desktop - Spammers List */}
        {!isMobile && (
          <Card className="p-6 glass-effect border-border/50 mb-8">
            <div className="space-y-4">
              {spammers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Немає доданих спамерів
                </div>
              ) : (
                spammers.map((spammer) => (
                  <div key={spammer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Send className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{spammer.name}</div>
                        {spammer.phone_number && (
                          <code className="text-xs text-muted-foreground block">
                            Phone: {spammer.phone_number}
                          </code>
                        )}
                        <code className="text-xs text-muted-foreground block">
                          TData: {spammer.tdata_path.slice(0, 30)}...
                        </code>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Надіслано: {spammer.messages_sent}</span>
                          <span>•</span>
                          <span>
                            {spammer.last_activity_at
                              ? new Date(spammer.last_activity_at).toLocaleDateString("uk-UA")
                              : "Не використовувався"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {spammer.is_authorized ? (
                        <Badge variant="default" className="bg-green-500">
                          ✓ Авторизований
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-500">
                          ⚠️ Потрібна авторизація
                        </Badge>
                      )}
                      <Badge variant={spammer.is_active ? "default" : "outline"}>
                        {spammer.is_active ? "Активний" : "Неактивний"}
                      </Badge>
                      {!spammer.is_authorized && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestSpammer(spammer)}
                          disabled={isTestingSpammer === spammer.id}
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          {isTestingSpammer === spammer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4 mr-1" />
                          )}
                          Авторизувати
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestSpammer(spammer)}
                        disabled={isTestingSpammer === spammer.id}
                      >
                        {isTestingSpammer === spammer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        <span className="ml-1">Тест</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSpammer(spammer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Mobile - Spammers Card View */}
        {isMobile && (
          <div className="space-y-3 mb-8">
            {spammers.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                Немає доданих спамерів
              </Card>
            ) : (
              spammers.map((spammer) => (
                <SpammerMobileCard
                  key={spammer.id}
                  spammer={spammer}
                  onDelete={handleDeleteSpammer}
                  onTest={handleTestSpammer}
                  isTesting={isTestingSpammer === spammer.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Spies Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="w-6 h-6" />
              Telegram Шпигуни
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Telegram Userbot (API ID + Hash) для збору інфо з приватних/публічних каналів
            </p>
          </div>
          <Button onClick={() => setIsSpyDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Додати шпигуна
          </Button>
        </div>

        {/* Desktop - Spies List */}
        {!isMobile && (
          <Card className="p-6 glass-effect border-border/50">
            <div className="space-y-4">
              {spies.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Немає доданих шпигунів
                </div>
              ) : (
                spies.map((spy) => (
                  <div key={spy.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{spy.name || "Шпигун"}</div>
                        <code className="text-xs text-muted-foreground block">
                          API ID: {spy.api_id}
                        </code>
                        <code className="text-xs text-muted-foreground block">
                          Hash: {spy.api_hash.slice(0, 20)}...
                        </code>
                        {spy.phone_number && (
                          <code className="text-xs text-muted-foreground block">
                            Phone: {spy.phone_number}
                          </code>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Каналів: {spy.channels_monitored}</span>
                          <span>•</span>
                          <span>
                            {spy.last_activity_at
                              ? new Date(spy.last_activity_at).toLocaleDateString("uk-UA")
                              : "Не використовувався"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {spy.is_authorized ? (
                        <Badge variant="default" className="bg-green-500">
                          ✓ Авторизований
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-500">
                          ⚠️ Потрібна авторизація
                        </Badge>
                      )}
                      <Badge variant={spy.is_active ? "default" : "outline"}>
                        {spy.is_active ? "Активний" : "Неактивний"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestSpy(spy)}
                        disabled={isTestingSpy === spy.id}
                      >
                        {isTestingSpy === spy.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        <span className="ml-1">Тест</span>
                      </Button>
                      {!spy.is_authorized && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAuthDialog(spy)}
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          <Lock className="w-4 h-4 mr-1" />
                          Авторизувати
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSpy(spy.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Mobile - Spies Card View */}
        {isMobile && (
          <div className="space-y-3">
            {spies.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                Немає доданих шпигунів
              </Card>
            ) : (
              spies.map((spy) => (
                <SpyMobileCard
                  key={spy.id}
                  spy={spy}
                  onDelete={handleDeleteSpy}
                  onTest={handleTestSpy}
                  onAuth={openAuthDialog}
                  isTesting={isTestingSpy === spy.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати нового бота</DialogTitle>
            <DialogDescription>
              Введіть токен бота отриманий від @BotFather
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bot_token">Токен бота *</Label>
              <Input
                id="bot_token"
                value={formData.bot_token}
                onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="bg-background/60 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot_name">Назва бота (опціонально)</Label>
              <Input
                id="bot_name"
                value={formData.bot_name}
                onChange={(e) => setFormData({ ...formData, bot_name: e.target.value })}
                placeholder="Мій Telegram Бот"
                className="bg-background/60 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Якщо не заповнено, буде використано ім'я з Telegram
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Тип бота *</Label>
              <RadioGroup 
                value={formData.bot_type} 
                onValueChange={(value: 'ai' | 'plagiarist') => setFormData({ ...formData, bot_type: value })}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="plagiarist" id="plagiarist" className="mt-1" />
                  <Label htmlFor="plagiarist" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Copy className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Бот Плагіатор</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Копіює контент з публічних та приватних каналів
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="ai" id="ai" className="mt-1" />
                  <Label htmlFor="ai" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Бот АІ</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Генерує контент автоматично за допомогою AI
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-foreground font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Webhook встановлюється автоматично
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Після додавання бота система автоматично налаштує webhook для отримання повідомлень
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleCreate}>Створити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати бота</DialogTitle>
            <DialogDescription>{selectedBot?.bot_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_bot_name">Назва бота</Label>
              <Input
                id="edit_bot_name"
                value={formData.bot_name}
                onChange={(e) => setFormData({ ...formData, bot_name: e.target.value })}
                className="bg-background/60 border-border/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Тип бота</Label>
              <RadioGroup 
                value={formData.bot_type} 
                onValueChange={(value: 'ai' | 'plagiarist') => setFormData({ ...formData, bot_type: value })}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="plagiarist" id="edit_plagiarist" className="mt-1" />
                  <Label htmlFor="edit_plagiarist" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Copy className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Бот Плагіатор</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Копіює контент з публічних та приватних каналів
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="ai" id="edit_ai" className="mt-1" />
                  <Label htmlFor="edit_ai" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Бот АІ</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Генерує контент автоматично за допомогою AI
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_webhook_url">Webhook URL (тільки для читання)</Label>
              <Input
                id="edit_webhook_url"
                value={formData.webhook_url}
                disabled
                className="bg-muted/50 border-border/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Webhook встановлюється автоматично при створенні/тестуванні бота
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleEdit}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <img 
                src={`https://ui-avatars.com/api/?name=${selectedBot?.bot_username || selectedBot?.bot_name || 'Bot'}&background=0D8ABC&color=fff&size=80`}
                alt={selectedBot?.bot_name || "Bot"}
                className="w-16 h-16 rounded-full border-2 border-border"
              />
              <div>
                <DialogTitle className="text-xl">{selectedBot?.bot_name}</DialogTitle>
                <DialogDescription className="text-base">@{selectedBot?.bot_username}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Card className="p-4 glass-effect">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Всього постів</p>
                  <p className="text-2xl font-bold">{selectedBot?.posts_count || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Підключених каналів</p>
                  <p className="text-2xl font-bold">{selectedBot?.channels_count || 0}</p>
                </div>
              </div>
            </Card>
            <div className="space-y-3 border rounded-lg p-4">
              <h3 className="font-semibold text-sm">Інформація про бота</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID бота:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{selectedBot?.id}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Назва:</span>
                  <span className="font-medium">{selectedBot?.bot_name || "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-medium">@{selectedBot?.bot_username || "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Статус:</span>
                  <Badge variant={selectedBot?.is_active ? "default" : "outline"}>
                    {selectedBot?.is_active ? "Активний" : "Неактивний"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Webhook URL:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs truncate">
                    {selectedBot?.webhook_url || "—"}
                  </code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Дата створення:</span>
                  <span>
                    {selectedBot?.created_at &&
                      new Date(selectedBot.created_at).toLocaleDateString("uk-UA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                  </span>
                </div>
                {selectedBot?.last_activity_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Остання активність:</span>
                    <span>
                      {new Date(selectedBot.last_activity_at).toLocaleDateString("uk-UA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsStatsDialogOpen(false)}>Закрити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Spy Dialog */}
      <Dialog open={isSpyDialogOpen} onOpenChange={setIsSpyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати шпигуна</DialogTitle>
            <DialogDescription>
              Створіть Telegram Userbot з API ID та Hash
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="spy_api_id">API ID *</Label>
              <Input
                id="spy_api_id"
                value={spyFormData.api_id}
                onChange={(e) => setSpyFormData({ ...spyFormData, api_id: e.target.value })}
                placeholder="12345678"
                className="bg-background/60 border-border/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                API ID з my.telegram.org
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spy_api_hash">API Hash *</Label>
              <Input
                id="spy_api_hash"
                value={spyFormData.api_hash}
                onChange={(e) => setSpyFormData({ ...spyFormData, api_hash: e.target.value })}
                placeholder="abcdef1234567890abcdef1234567890"
                className="bg-background/60 border-border/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                API Hash з my.telegram.org
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spy_phone">Номер телефону (опціонально)</Label>
              <Input
                id="spy_phone"
                value={spyFormData.phone_number}
                onChange={(e) => setSpyFormData({ ...spyFormData, phone_number: e.target.value })}
                placeholder="+380123456789"
                className="bg-background/60 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Для прив'язки userbot до акаунту
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spy_name">Назва (опціонально)</Label>
              <Input
                id="spy_name"
                value={spyFormData.name}
                onChange={(e) => setSpyFormData({ ...spyFormData, name: e.target.value })}
                placeholder="Мій шпигун"
                className="bg-background/60 border-border/50"
              />
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm text-foreground font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Що робить шпигун?
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Використовує Telegram Userbot API</li>
                <li>Заходить на приватні канали через MTProto</li>
                <li>Збирає статистику і метадані каналів</li>
                <li>Моніторить публічні канали для аналітики</li>
                <li>Працює автоматично в фоні</li>
              </ul>
              <div className="mt-3 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs font-semibold text-blue-400 mb-1">📖 Як отримати API ID та Hash:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Перейдіть на <code className="bg-background/60 px-1 rounded">my.telegram.org</code></li>
                  <li>Увійдіть з номером телефону</li>
                  <li>Перейдіть в "API development tools"</li>
                  <li>Створіть додаток (будь-яка назва)</li>
                  <li>Скопіюйте <strong>api_id</strong> та <strong>api_hash</strong></li>
                  <li>Вставте їх у форму вище</li>
                </ol>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSpyDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleCreateSpy}>Створити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Spammer Dialog */}
      <Dialog open={isSpammerDialogOpen} onOpenChange={setIsSpammerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати спамера</DialogTitle>
            <DialogDescription>
              Завантажте TData папку з Telegram акаунтом
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="spammer_name">Назва *</Label>
              <Input
                id="spammer_name"
                value={spammerFormData.name}
                onChange={(e) => setSpammerFormData({ ...spammerFormData, name: e.target.value })}
                placeholder="Мій спамер"
                className="bg-background/60 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spammer_phone">Номер телефону (опціонально)</Label>
              <Input
                id="spammer_phone"
                value={spammerFormData.phone_number}
                onChange={(e) => setSpammerFormData({ ...spammerFormData, phone_number: e.target.value })}
                placeholder="+380123456789"
                className="bg-background/60 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tdata_file">TData файл *</Label>
              <Input
                id="tdata_file"
                type="file"
                accept=".zip,.rar,.7z"
                onChange={(e) => setSpammerFormData({ 
                  ...spammerFormData, 
                  tdata_file: e.target.files?.[0] || null 
                })}
                className="bg-background/60 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Архів з папкою tdata від Telegram Desktop
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="authkey">AuthKey (опціонально)</Label>
              <Input
                id="authkey"
                value={spammerFormData.authkey}
                onChange={(e) => setSpammerFormData({ ...spammerFormData, authkey: e.target.value })}
                placeholder="Ключ авторизації"
                className="bg-background/60 border-border/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Додатковий ключ для авторизації (якщо потрібен)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-foreground font-medium flex items-center gap-2">
                <Send className="w-4 h-4" />
                Як отримати TData?
              </p>
              <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                <li>Відкрийте Telegram Desktop</li>
                <li>Знайдіть папку tdata (AppData\Roaming\Telegram Desktop\tdata)</li>
                <li>Заархівуйте папку tdata</li>
                <li>Завантажте архів сюди</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSpammerDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleCreateSpammer}>Створити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Userbot Authorization Dialog */}
      {selectedSpy && (
        <UserbotAuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setIsAuthDialogOpen}
          spyId={selectedSpy.id}
          spyName={selectedSpy.name || 'Шпигун'}
          phoneNumber={selectedSpy.phone_number}
          onSuccess={async () => {
            await loadSpies();
            toast({
              title: "Готово!",
              description: "Userbot авторизовано та готовий до роботи",
              duration: 3000,
            });
          }}
        />
      )}
    </div>
  );
};
