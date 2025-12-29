import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Check, X, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface BotService {
  id: string;
  user_id: string;
  target_channel: string;
  is_running: boolean;
  posts_per_month?: number;
  post_interval_minutes: number;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface AIBotService {
  id: string;
  user_id: string;
  target_channel: string;
  is_running: boolean;
  service_type: string;
  bot_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
  bot?: {
    bot_name: string | null;
    bot_username: string | null;
  } | null;
}

interface ChannelService {
  type: 'plagiarist' | 'ai';
  service: BotService | AIBotService;
}

export const ChannelsManagement = () => {
  const { toast } = useToast();
  const [channelServices, setChannelServices] = useState<ChannelService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadChannelServices();

    // Real-time updates for bot services
    const servicesChannel = supabase
      .channel('admin_bot_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
        },
        () => {
          console.log('Bot service changed, reloading...');
          loadChannelServices();
        }
      )
      .subscribe();

    // Real-time updates for AI bot services
    const aiServicesChannel = supabase
      .channel('admin_ai_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_bot_services',
        },
        () => {
          console.log('AI service changed, reloading...');
          loadChannelServices();
        }
      )
      .subscribe();

    return () => {
      servicesChannel.unsubscribe();
      aiServicesChannel.unsubscribe();
    };
  }, []);

  const loadChannelServices = async () => {
    try {
      const services: ChannelService[] = [];

      // Load plagiarist bot services
      const { data: botServices, error: servicesError } = await supabase
        .from("bot_services")
        .select("*")
        .order("created_at", { ascending: false });

      if (servicesError) throw servicesError;

      // Load profiles for bot services
      if (botServices && botServices.length > 0) {
        const userIds = botServices.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        botServices.forEach(service => {
          services.push({
            type: 'plagiarist',
            service: {
              ...service,
              profiles: profiles?.find(p => p.id === service.user_id) || null
            }
          });
        });
      }

      // Load AI bot services
      const { data: aiServices, error: aiServicesError } = await supabase
        .from("ai_bot_services")
        .select(`
          *,
          telegram_bots!inner(bot_name, bot_username)
        `)
        .order("created_at", { ascending: false });

      if (aiServicesError) throw aiServicesError;

      // Load profiles for AI services
      if (aiServices && aiServices.length > 0) {
        const userIds = aiServices.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        aiServices.forEach(service => {
          services.push({
            type: 'ai',
            service: {
              ...service,
              profiles: profiles?.find(p => p.id === service.user_id) || null,
              bot: service.telegram_bots
            }
          });
        });
      }

      setChannelServices(services);
    } catch (error: any) {
      console.error("Error loading channel services:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити канали",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (channelService: ChannelService, currentStatus: boolean) => {
    try {
      const table = channelService.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      
      const { error } = await supabase
        .from(table)
        .update({ is_running: !currentStatus })
        .eq("id", channelService.service.id);

      if (error) throw error;

      toast({
        title: "Статус оновлено",
        description: `Бот ${!currentStatus ? "запущено" : "зупинено"}`,
        duration: 1500,
      });

      await loadChannelServices();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const filteredServices = channelServices.filter(
    (channelService) => {
      const service = channelService.service;
      return service.target_channel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase());
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Bot className="w-8 h-8 animate-pulse text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Завантаження каналів...</p>
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
            placeholder="Пошук по каналах..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline" className="text-sm">
          Всього каналів: {channelServices.length}
        </Badge>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Канал</TableHead>
                <TableHead className="font-semibold">Власник</TableHead>
                <TableHead className="font-semibold">Тип бота</TableHead>
                <TableHead className="font-semibold">Статус</TableHead>
                <TableHead className="font-semibold">Дата створення</TableHead>
                <TableHead className="font-semibold text-right">Керування</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchTerm ? "Каналів не знайдено" : "Немає активних каналів"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((channelService) => {
                  const service = channelService.service;
                  const isPlagiarist = channelService.type === 'plagiarist';
                  const aiService = !isPlagiarist ? channelService.service as AIBotService : null;
                  
                  return (
                    <TableRow key={service.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-primary" />
                          <span className="font-medium">{service.target_channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {service.profiles?.full_name || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {service.profiles?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isPlagiarist ? "outline" : "secondary"}>
                          {isPlagiarist ? "Плагіатор" : "AI"}
                        </Badge>
                        {aiService?.bot && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {aiService.bot.bot_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {service.is_running ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <Check className="w-3 h-3 mr-1" />
                            Активний
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <X className="w-3 h-3 mr-1" />
                            Зупинено
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(service.created_at).toLocaleDateString("uk-UA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={service.is_running}
                          onCheckedChange={() =>
                            handleToggleStatus(channelService, service.is_running)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

