import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState("Обробка авторизації...");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      setStatus("Отримання даних користувача...");

      // Supabase automatically handles the OAuth callback
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error("Не вдалося створити сесію");
      }

      const user = session.user;

      // Get referral code from localStorage
      const referralCode = localStorage.getItem('pending_referral_code');
      if (referralCode) {
        localStorage.removeItem('pending_referral_code');
      }

      // Check if this is a new user (just registered)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, created_at, google_id")
        .eq("id", user.id)
        .single();

      const isNewUser = profile && new Date(profile.created_at).getTime() > Date.now() - 30000; // Created in last 30 seconds

      // Update google_id if not set
      if (profile && !profile.google_id && user.app_metadata.provider === 'google') {
        const googleId = user.user_metadata.sub || user.user_metadata.provider_id;
        if (googleId) {
          await supabase
            .from("profiles")
            .update({ google_id: googleId })
            .eq("id", user.id);
        }
      }

      // Process referral bonus if new user
      if (isNewUser && referralCode && user) {
        setStatus("Нараховування бонусів...");
        
        try {
          // Get referrer profile
          const { data: referrerProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", referralCode)
            .maybeSingle();

          if (referrerProfile && referrerProfile.id !== user.id) {
            // Get referral settings
            const { data: settingsData } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "referral_config")
              .maybeSingle();

            const config = (settingsData?.value as any) || {};
            const referrerBonus = config.referrer_bonus || 5;
            const refereeBonus = config.referee_bonus || 3;

            // Add referral record
            await supabase.from("referrals").insert({
              referrer_id: referrerProfile.id,
              referred_id: user.id,
              bonus_amount: referrerBonus,
            });

            // Add bonus to referrer
            const { data: referrerData } = await supabase
              .from("profiles")
              .select("bonus_balance")
              .eq("id", referrerProfile.id)
              .single();
            
            if (referrerData) {
              await supabase
                .from("profiles")
                .update({ bonus_balance: referrerData.bonus_balance + referrerBonus })
                .eq("id", referrerProfile.id);
            }

            // Add bonus to new user
            const { data: newUserData } = await supabase
              .from("profiles")
              .select("bonus_balance")
              .eq("id", user.id)
              .single();
            
            if (newUserData) {
              await supabase
                .from("profiles")
                .update({ bonus_balance: newUserData.bonus_balance + refereeBonus })
                .eq("id", user.id);
            }

            toast({
              title: "Бонуси нараховано!",
              description: `Ви отримали ${refereeBonus} бонусів за реєстрацію по реферальному посиланню`,
            });
          }
        } catch (refError) {
          console.error("Referral bonus error:", refError);
          // Don't throw - user is registered, bonus failed
        }
      }

      toast({
        title: "Успішно!",
        description: isNewUser ? "Ви зареєструвались через Google" : "Ви увійшли через Google",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Callback error:", error);
      toast({
        title: "Помилка авторизації",
        description: error.message || "Не вдалося завершити авторизацію",
        variant: "destructive",
      });
      navigate("/auth");
    }
  };

  return <Loading message={status} />;
};

export default AuthCallback;
