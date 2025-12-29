import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { isAndroidAPK } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface TelegramLoginButtonProps {
  botUsername: string;
  onAuth?: (user: any) => void;
}

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: any) => void;
    };
  }
}

export const TelegramLoginButton = ({ botUsername, onAuth }: TelegramLoginButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAPK = isAndroidAPK();

  useEffect(() => {
    // Callback function that will be called by Telegram
    const handleTelegramAuth = async (user: any) => {
      console.log('Telegram login callback received:', user);
      
      try {
        console.log('Invoking telegram-login edge function...');
        
        // Get referral code from URL if present
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        
        // Send data to our edge function - keep telegram data separate from referral code
        const { data, error } = await supabase.functions.invoke('telegram-login', {
          body: {
            telegram_data: user,
            referral_code: refCode || null,
          }
        });

        console.log('Edge function response:', { data, error });

        if (error) {
          console.error('Login error:', error);
          toast({
            title: "Помилка",
            description: "Не вдалося увійти через Telegram",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }

        if (!data.success) {
          throw new Error(data.error || 'Authentication failed');
        }

        console.log('Setting session with tokens...');
        
        // Set session using tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        console.log('Session set successfully!');

        toast({
          title: "Успішно!",
          description: data.is_new_user ? "Ваш акаунт створено" : "Ви успішно увійшли",
          duration: 2000,
        });

        if (onAuth) {
          onAuth(user);
        }

        // Navigate to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);

      } catch (error: any) {
        console.error('Telegram auth error:', error);
        toast({
          title: "Помилка",
          description: error.message || "Не вдалося авторизуватися",
          variant: "destructive",
          duration: 3000,
        });
      }
    };

    // Set global callback
    window.TelegramLoginWidget = {
      dataOnauth: handleTelegramAuth
    };

    // Load Telegram Login Widget script
    if (containerRef.current && botUsername) {
      console.log('Loading Telegram widget for bot:', botUsername);
      
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername.replace('@', ''));
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;

      script.onerror = () => {
        console.error('Failed to load Telegram widget script');
        toast({
          title: "Помилка",
          description: "Не вдалося завантажити Telegram віджет",
          variant: "destructive",
          duration: 3000,
        });
      };

      script.onload = () => {
        console.log('Telegram widget script loaded successfully');
      };

      // Clear previous widget if exists
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [botUsername, onAuth, navigate, toast]);

  if (!botUsername) {
    return null;
  }

  // APK version - show button to open Telegram bot
  if (isAPK) {
    const handleTelegramOpen = () => {
      const cleanUsername = botUsername.replace('@', '');
      window.open(`https://t.me/${cleanUsername}`, '_blank');
      
      toast({
        title: "Відкрийте Telegram",
        description: "Натисніть /start в боті для авторизації",
        duration: 5000,
      });
    };

    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleTelegramOpen}
        className="w-full flex items-center justify-center gap-2 border-2 bg-[#0088cc] hover:bg-[#006699] text-white border-[#0088cc]"
      >
        <Send className="w-5 h-5" />
        Увійти через Telegram
      </Button>
    );
  }

  // Web version - use Telegram widget
  return (
    <div 
      ref={containerRef} 
      className="flex justify-center w-full"
      style={{ minHeight: '46px' }}
    />
  );
};
