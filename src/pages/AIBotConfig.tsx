import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AIBotSetup } from "@/components/ai/AIBotSetup";
import { Zap } from "lucide-react";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface TelegramBot {
  id: string;
  bot_token: string;
  bot_name: string | null;
  bot_username: string | null;
  bot_type: 'ai' | 'plagiarist' | null;
}

const AIBotConfig = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<TelegramBot | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Get bot ID from location state or query params
      const botId = location.state?.botId || new URLSearchParams(location.search).get('botId');
      
      if (!botId) {
        navigate("/bot-setup");
        return;
      }

      // Load bot info
      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("*")
        .eq("id", botId)
        .eq("user_id", session.user.id)
        .eq("bot_type", "ai")
        .single();

      if (!bot) {
        navigate("/bot-setup");
        return;
      }

      setSelectedBot(bot);
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate, location]);

  if (isLoading || !user || !selectedBot) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          icon={Zap}
          title={`Налаштування AI бота ${selectedBot.bot_name || ''}`}
          description="Налаштуйте автоматичну генерацію контенту за допомогою штучного інтелекту"
          backTo="/my-channels"
          backLabel="Повернутись до каналів"
        />
        <AIBotSetup 
          botId={selectedBot.id} 
          botUsername={selectedBot.bot_username || ""}
          botToken={selectedBot.bot_token}
          userId={user.id}
          serviceId={location.state?.aiServiceId}
        />
      </div>
    </div>
  );
};

export default AIBotConfig;
