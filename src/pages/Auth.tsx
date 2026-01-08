import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Mail, Lock, User, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Footer } from "@/components/Footer";
import { ParticleBackground } from "@/components/ParticleBackground";
import { isAndroidAPK } from "@/lib/platform";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import authBotImage from "@/assets/auth-bot-telegram.png";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { initiateGoogleAuth } from "@/lib/google-oauth";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const isAPK = isAndroidAPK();
  console.log("Auth page - isAPK:", isAPK);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(true);
  const recaptchaSignInRef = useRef<ReCAPTCHA>(null);
  const recaptchaSignUpRef = useRef<ReCAPTCHA>(null);
  const [telegramAuthEnabled, setTelegramAuthEnabled] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(true); // Always enabled - configured in Supabase
  const { settings } = useGeneralSettings();

  // Sign In state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up state
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");

  useEffect(() => {
    // Перевірка чи користувач вже залогінений
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("Existing session found, redirecting to dashboard");
        navigate("/dashboard");
      }
    };

    checkExistingSession();

    // Слухач змін автентифікації
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      if (session && event === 'SIGNED_IN') {
        console.log("User signed in, redirecting to dashboard");
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    loadRecaptchaSettings();
    loadTelegramAuthSettings();
    loadEmailConfirmationSettings();
    loadReferralSettings();
    
    // Referral code logic removed - now handled via ReferralCodeDialog after signup

    // Підписка на реал-тайм зміни налаштувань
    const channel = supabase
      .channel('auth_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=in.(recaptcha,telegram_login_widget,general_settings,referral_config)',
        },
        (payload) => {
          console.log('Settings changed:', payload);
          // Перезавантажити всі налаштування
          loadRecaptchaSettings();
          loadTelegramAuthSettings();
          loadEmailConfirmationSettings();
          loadReferralSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchParams]);

  // loadReferrerInfo removed - not needed with new referral system

  const loadRecaptchaSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "recaptcha")
        .single();

      if (!error && data) {
        const settings = data.value as any;
        setRecaptchaEnabled(settings.enabled || false);
        setRecaptchaSiteKey(settings.site_key || "");
      }
    } catch (error) {
      console.error("Error loading reCAPTCHA settings:", error);
    }
  };

  const loadTelegramAuthSettings = async () => {
    try {
      // Load old bot settings
      const { data: botData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_auth_bot")
        .single();

      if (botData) {
        const botSettings = botData.value as any;
        if (botSettings.enabled) {
          setTelegramAuthEnabled(true);
          setTelegramBotUsername(botSettings.bot_username || "");
        }
      }

      // Load new Login Widget settings
      const { data: widgetData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_login_widget")
        .single();

      if (widgetData) {
        const widgetSettings = widgetData.value as any;
        if (widgetSettings.enabled) {
          setTelegramAuthEnabled(true);
          setTelegramBotUsername(widgetSettings.bot_username || "");
        }
      }
    } catch (error) {
      console.error("Error loading Telegram auth settings:", error);
    }
  };

  const loadEmailConfirmationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "general_settings")
        .single();

      if (!error && data) {
        const settings = data.value as any;
        setEmailConfirmationRequired(settings.email_confirmation_required !== false);
      }
    } catch (error) {
      console.error("Error loading email confirmation settings:", error);
    }
  };

  const loadReferralSettings = async () => {
    try {
      console.log("🔍 Loading referral settings...");
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "referral_config")
        .single();

      console.log("📊 Referral settings data:", data);
      console.log("❌ Referral settings error:", error);

      if (data && !error) {
        const config = data.value as any;
        console.log("✅ Parsed config:", config);
        // Referral bonus settings removed - handled in apply_referral_code function
      } else {
        console.warn("⚠️ No data or error occurred, using defaults");
      }
    } catch (error) {
      console.error("❌ Error loading referral settings:", error);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      // Same flow for web and APK - OAuth opens in same window/WebView
      await initiateGoogleAuth(null); // Referral handled via dialog after signup
      // Supabase will automatically redirect to Google
    } catch (error: any) {
      console.error("Google auth error:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося авторизуватись через Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleTelegramAuth = () => {
    if (!telegramBotUsername) {
      toast({
        title: "Помилка",
        description: "Telegram авторизація не налаштована",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    setShowTelegramDialog(true);
  };

  // Telegram Login Widget callback
  const handleTelegramResponse = async (user: any) => {
    setIsLoading(true);
    try {
      console.log("Telegram auth data received:", user);

      // Call telegram-auth edge function
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url,
          auth_date: user.auth_date,
          hash: user.hash,
        },
      });

      if (error) {
        console.error("Telegram auth error:", error);
        throw new Error(error.message || "Помилка авторизації через Telegram");
      }

      if (!data.success || !data.auth_url) {
        throw new Error("Не вдалося отримати посилання для авторизації");
      }

      console.log("Telegram auth successful, redirecting to:", data.auth_url);

      // Redirect to auth URL
      window.location.href = data.auth_url;
    } catch (error: any) {
      console.error("Telegram auth error:", error);
      toast({
        title: "Помилка авторизації",
        description: error.message || "Не вдалося увійти через Telegram",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Setup callback for Telegram Widget
    (window as any).onTelegramAuth = handleTelegramResponse;

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verify reCAPTCHA if enabled
      if (recaptchaEnabled && recaptchaSignInRef.current) {
        const token = await recaptchaSignInRef.current.executeAsync();
        if (!token) {
          throw new Error("Не вдалося пройти перевірку reCAPTCHA");
        }
        recaptchaSignInRef.current.reset();
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (error) {
        // Generic error message to prevent account enumeration
        throw new Error("Невірні дані для входу. Перевірте email та пароль.");
      }

      if (!data.session) {
        throw new Error("Не вдалося створити сесію");
      }

      // Get user IP and device info
      let userIP = "Unknown";
      let deviceInfo = navigator.userAgent;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        userIP = ipData.ip;
      } catch (error) {
        console.error("Could not fetch IP:", error);
      }

      // Create login notification
      try {
        await supabase.rpc('create_notification', {
          p_user_id: data.user.id,
          p_type: 'account_login',
          p_title: 'Новий вхід в систему',
          p_message: `Ви увійшли з пристрою: ${deviceInfo.substring(0, 50)}... IP: ${userIP}`,
          p_link: '/profile'
        });
      } catch (notifError) {
        console.error("Could not create login notification:", notifError);
      }

      toast({
        title: "Успішно!",
        description: "Ви увійшли в систему",
        duration: 1500,
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Помилка входу",
        description: error.message || "Не вдалося увійти",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Базова валідація
      if (signUpPassword !== signUpConfirmPassword) {
        throw new Error("Паролі не співпадають");
      }

      if (signUpPassword.length < 6) {
        throw new Error("Пароль має містити мінімум 6 символів");
      }

      // Verify reCAPTCHA if enabled
      if (recaptchaEnabled && recaptchaSignUpRef.current) {
        const token = await recaptchaSignUpRef.current.executeAsync();
        if (!token) {
          throw new Error("Не вдалося пройти перевірку reCAPTCHA");
        }
        recaptchaSignUpRef.current.reset();
      }

      // Get user IP address
      let userIP = null;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        userIP = ipData.ip;
      } catch (error) {
        console.error("Could not fetch IP:", error);
      }

      // Referral code validation removed - handled via dialog after signup

      // Реєстрація користувача
      console.log("Starting signup for:", signUpEmail);
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.toLowerCase(),
        password: signUpPassword,
        options: {
          data: {
            full_name: signUpFullName,
            registration_ip: userIP,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      console.log("Signup response:", { user: data?.user?.id, session: !!data?.session, error, identities: data?.user?.identities?.length });

      if (error) {
        console.error("Signup error:", error);
        throw new Error(error.message);
      }

      if (!data.user) {
        console.error("No user returned from signup");
        throw new Error("Не вдалося створити користувача");
      }

      // Перевірка чи це повторна реєстрація
      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error("Користувач з таким email вже зареєстрований");
      }

      console.log("User created successfully:", data.user.id);


      // Очистити форму
      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpConfirmPassword("");
      setSignUpFullName("");

      // Очистити форму
      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpConfirmPassword("");
      setSignUpFullName("");

      // Якщо сесія створена автоматично (email confirmation вимкнена)
      if (data.session) {
        console.log("Session created automatically, redirecting");
        toast({
          title: "Вітаємо!",
          description: "Реєстрація успішна! Перенаправляємо...",
          duration: 1500,
        });
        // onAuthStateChange автоматично перенаправить на dashboard
        return;
      }

      // Якщо потрібне підтвердження email
      if (emailConfirmationRequired) {
        toast({
          title: "Реєстрація успішна!",
          description: "Перевірте email для підтвердження реєстрації.",
          duration: 4000,
        });
        return;
      }

      // Якщо email confirmation вимкнена але сесії немає - входимо вручну
      console.log("Email confirmation disabled, attempting auto sign-in");
      toast({
        title: "Завантаження...",
        description: "Входимо в систему...",
        duration: 1500,
      });

      setTimeout(async () => {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: signUpEmail.toLowerCase(),
          password: signUpPassword,
        });
        
        if (signInError) {
          console.error("Auto sign-in failed:", signInError);
          toast({
            title: "Увійдіть вручну",
            description: "Реєстрація успішна. Будь ласка, увійдіть.",
            duration: 3000,
          });
        }
      }, 500);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Помилка реєстрації",
        description: error.message || "Не вдалося створити акаунт",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 animate-gradient-slow -z-20" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 -z-10" />
      
      {/* Particle effect */}
      <ParticleBackground />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '6s' }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 pb-20 sm:pb-8 relative z-10">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16">
          {/* Realistic 3D Bot Scene - Smaller on mobile, larger on desktop */}
          <div className="flex-shrink-0 relative perspective-1000">
            <div className="w-72 h-72 lg:w-[450px] lg:h-[450px] relative animate-scale-in" style={{ animationDuration: '0.6s', transformStyle: 'preserve-3d' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
                  
                  {/* Ambient lighting */}
                  <div className="absolute inset-0 bg-gradient-radial from-blue-500/10 via-transparent to-transparent blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                  
                  {/* Main scene container */}
                  <div className="relative w-full h-full flex items-center justify-center" style={{ transform: 'rotateX(5deg) rotateY(-5deg)', transformStyle: 'preserve-3d' }}>
                    
                    {/* Floor shadow */}
                    <div className="absolute bottom-12 lg:bottom-16 left-1/2 -translate-x-1/2 w-40 h-6 lg:w-56 lg:h-8 bg-black/20 rounded-full blur-xl" style={{ transform: 'rotateX(90deg) translateZ(-20px)' }} />
                    
                    {/* Realistic Bot */}
                    <div className="relative animate-float" style={{ animationDuration: '4s', transformStyle: 'preserve-3d' }}>
                      
                      {/* Bot Head */}
                      <div className="relative w-28 h-32 lg:w-40 lg:h-44 mx-auto" style={{ transformStyle: 'preserve-3d' }}>
                        {/* Head main body */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 shadow-2xl" style={{ 
                          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 2px 4px 0 rgba(255, 255, 255, 0.6)',
                          transform: 'translateZ(20px)'
                        }}>
                          {/* Metallic shine */}
                          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/60 via-transparent to-transparent" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 50%, 0 30%)' }} />
                          
                          {/* Side panel lines */}
                          <div className="absolute left-2 top-6 bottom-6 w-0.5 bg-slate-400/50 rounded-full" />
                          <div className="absolute right-2 top-6 bottom-6 w-0.5 bg-slate-400/50 rounded-full" />
                        </div>
                        
                        {/* Antenna with glow */}
                        <div className="absolute -top-8 lg:-top-10 left-1/2 -translate-x-1/2" style={{ transform: 'translateZ(25px)' }}>
                          <div className="w-1.5 h-8 lg:h-10 bg-gradient-to-t from-slate-400 to-slate-500 rounded-full shadow-lg mx-auto relative">
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-white/40 rounded-full" />
                          </div>
                          <div className="relative w-4 h-4 lg:w-5 lg:h-5 mx-auto -mt-0.5">
                            <div className="absolute inset-0 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" style={{ animationDuration: '2s' }} />
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
                            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/60 to-transparent" />
                            <div className="absolute inset-0 rounded-full bg-red-400 blur-md animate-ping" style={{ animationDuration: '3s' }} />
                          </div>
                        </div>
                        
                        {/* Eye visor with realistic glass effect */}
                        <div className="absolute top-10 lg:top-14 left-1/2 -translate-x-1/2 w-20 lg:w-28 h-10 lg:h-14 rounded-2xl overflow-hidden" style={{ 
                          transform: 'translateZ(22px)',
                          boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(255, 255, 255, 0.5)'
                        }}>
                          {/* Glass visor */}
                          <div className="absolute inset-0 bg-gradient-to-b from-cyan-400 via-blue-500 to-blue-600 opacity-90" />
                          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/20" />
                          
                          {/* Eyes with light effects */}
                          <div className="absolute inset-0 flex items-center justify-center gap-3 lg:gap-4">
                            <div className="relative w-3 h-8 lg:w-4 lg:h-10">
                              <div className="absolute inset-0 bg-cyan-300 rounded-full blur-sm" />
                              <div className="absolute inset-0 bg-white rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                              <div className="absolute inset-0 bg-gradient-to-b from-white to-cyan-200 rounded-full" />
                              <div className="absolute top-1 left-1 w-1.5 h-3 lg:w-2 lg:h-4 bg-white/80 rounded-full blur-sm" />
                            </div>
                            <div className="relative w-3 h-8 lg:w-4 lg:h-10">
                              <div className="absolute inset-0 bg-cyan-300 rounded-full blur-sm" />
                              <div className="absolute inset-0 bg-white rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.3s' }} />
                              <div className="absolute inset-0 bg-gradient-to-b from-white to-cyan-200 rounded-full" />
                              <div className="absolute top-1 left-1 w-1.5 h-3 lg:w-2 lg:h-4 bg-white/80 rounded-full blur-sm" />
                            </div>
                          </div>
                          
                          {/* Scan line effect */}
                          <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute inset-x-0 h-0.5 bg-white/50 animate-scan" style={{ 
                              animation: 'scan 3s linear infinite',
                              boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)'
                            }} />
                          </div>
                        </div>
                        
                        {/* Mouth line */}
                        <div className="absolute bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 w-12 lg:w-16 h-1 bg-slate-400 rounded-full shadow-inner" style={{ transform: 'translateZ(20px)' }} />
                      </div>
                      
                      {/* Body with depth */}
                      <div className="relative w-24 h-20 lg:w-32 lg:h-28 mx-auto -mt-3 rounded-3xl bg-gradient-to-br from-slate-300 via-slate-200 to-slate-400 shadow-2xl" style={{ 
                        transformStyle: 'preserve-3d',
                        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.4), inset 0 2px 4px 0 rgba(255, 255, 255, 0.5)',
                        transform: 'translateZ(15px)'
                      }}>
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-transparent to-black/10" />
                        
                        {/* Chest circle with glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 lg:w-14 lg:h-14" style={{ transform: 'translate(-50%, -50%) translateZ(5px)' }}>
                          <div className="absolute inset-0 rounded-full bg-blue-400 blur-lg animate-pulse" style={{ animationDuration: '2s' }} />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg" style={{ boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)' }} />
                          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500" />
                          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-white/60 to-transparent" />
                        </div>
                        
                        {/* Panel details */}
                        <div className="absolute top-3 left-3 w-2 h-2 rounded-sm bg-slate-500 shadow-inner" />
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-sm bg-slate-500 shadow-inner" />
                      </div>
                      
                      {/* Arms with joints */}
                      <div className="absolute top-[115px] lg:top-[160px] -left-7 lg:-left-10 w-5 h-16 lg:w-7 lg:h-20" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(10px) rotateZ(-10deg)' }}>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 shadow-xl" style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.5)' }} />
                        <div className="absolute top-0 left-0 right-0 h-3 rounded-full bg-slate-400 shadow-inner" />
                      </div>
                      <div className="absolute top-[115px] lg:top-[160px] -right-7 lg:-right-10 w-5 h-16 lg:w-7 lg:h-20" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(10px) rotateZ(10deg)' }}>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 shadow-xl" style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.5)' }} />
                        <div className="absolute top-0 left-0 right-0 h-3 rounded-full bg-slate-400 shadow-inner" />
                      </div>
                    </div>
                    
                    {/* Telegram badge with 3D effect */}
                    <div className="absolute -top-4 -right-4 lg:-top-6 lg:-right-6 w-20 h-20 lg:w-28 lg:h-28 animate-bounce z-30" style={{ 
                      animationDuration: '2.5s',
                      transformStyle: 'preserve-3d',
                      transform: 'translateZ(40px)'
                    }}>
                      <div className="absolute inset-0 rounded-full bg-blue-400 blur-xl opacity-60" />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl" style={{ 
                        boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.6), inset 0 2px 6px rgba(255, 255, 255, 0.4)'
                      }} />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-transparent to-black/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-10 h-10 lg:w-14 lg:h-14 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Growth Chart with glass morphism */}
                    <div className="absolute bottom-0 right-0 lg:bottom-4 lg:right-4 z-20" style={{ transform: 'translateZ(30px)' }}>
                      <div className="relative w-24 h-20 lg:w-36 lg:h-28 rounded-2xl overflow-hidden" style={{ 
                        background: 'rgba(15, 23, 42, 0.7)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(96, 165, 250, 0.2)'
                      }}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                        
                        {/* Chart bars with realistic shadows */}
                        <div className="relative h-full flex items-end justify-around p-3 lg:p-4 gap-1.5 lg:gap-2">
                          {[40, 60, 75, 100].map((height, i) => (
                            <div key={i} className="relative flex-1" style={{ height: `${height}%` }}>
                              <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-lg shadow-lg animate-pulse" style={{ 
                                animationDelay: `${i * 0.2}s`,
                                animationDuration: '2s',
                                boxShadow: `0 -5px 15px -3px ${i === 3 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.4)'}`
                              }}>
                                {i === 3 && <div className="absolute inset-0 bg-gradient-to-t from-emerald-600 to-green-400 rounded-t-lg" />}
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg" />
                            </div>
                          ))}
                        </div>
                        
                        {/* Arrow indicator */}
                        <div className="absolute -top-3 -right-3 lg:-top-4 lg:-right-4 w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg flex items-center justify-center animate-bounce" style={{ 
                          animationDuration: '1.5s',
                          boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5), inset 0 1px 3px rgba(255, 255, 255, 0.3)'
                        }}>
                          <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Ambient particles */}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full animate-ping"
                        style={{
                          top: `${20 + i * 15}%`,
                          left: `${10 + i * 12}%`,
                          background: ['#06b6d4', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][i],
                          animationDuration: `${2 + i * 0.5}s`,
                          animationDelay: `${i * 0.3}s`,
                          boxShadow: `0 0 10px ${['#06b6d4', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][i]}`,
                          transform: `translateZ(${20 + i * 5}px)`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* CSS for scan animation */}
            <style>{`
              @keyframes scan {
                0%, 100% { top: 0; }
                50% { top: 100%; }
              }
            `}</style>
          </div>

          <div className="w-full max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2 mb-6 sm:mb-8 group">
            {settings.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={settings.site_name} 
                className="h-10 sm:h-12 w-auto object-contain"
              />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow transition-smooth group-hover:scale-110">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
              </div>
            )}
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {settings.site_name || "TelePostBot"}
            </span>
          </Link>

          <Card className="p-6 sm:p-8 glass-card shadow-card">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-background/80">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Вхід
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Реєстрація
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="flex items-center gap-2 text-foreground font-medium">
                      <Mail className="w-4 h-4 text-primary" />
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password" className="flex items-center gap-2 text-foreground font-medium">
                        <Lock className="w-4 h-4 text-primary" />
                        Пароль
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPasswordDialog(true)}
                        className="text-sm text-primary hover:text-primary-glow transition-smooth"
                      >
                        Забули пароль?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  {recaptchaEnabled && recaptchaSiteKey && (
                    <div className="hidden">
                      <ReCAPTCHA
                        ref={recaptchaSignInRef}
                        size="invisible"
                        sitekey={recaptchaSiteKey}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow text-primary-foreground font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "Завантаження..." : "Увійти"}
                  </Button>

                  {(telegramAuthEnabled && telegramBotUsername || googleOAuthEnabled) && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">або</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-center text-muted-foreground">
                          Швидкий вхід через соцмережі
                        </p>
                        
                        {telegramAuthEnabled && telegramBotUsername && (
                          <TelegramLoginButton botUsername={telegramBotUsername} />
                        )}

                        {googleOAuthEnabled && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleAuth}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 border-2"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Увійти через Google
                          </Button>
                        )}

                        <p className="text-xs text-center text-muted-foreground">
                          При першому вході запросить дозвіл на передачу ваших даних
                        </p>
                      </div>
                    </>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-6">

                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="flex items-center gap-2 text-foreground font-medium">
                      <User className="w-4 h-4 text-primary" />
                      Повне ім'я
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Іван Петренко"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      required
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="flex items-center gap-2 text-foreground font-medium">
                      <Mail className="w-4 h-4 text-primary" />
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="flex items-center gap-2 text-foreground font-medium">
                      <Lock className="w-4 h-4 text-primary" />
                      Пароль
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="flex items-center gap-2 text-foreground font-medium">
                      <Lock className="w-4 h-4 text-primary" />
                      Повторіть пароль
                    </Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-background/60 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  {recaptchaEnabled && recaptchaSiteKey && (
                    <div className="hidden">
                      <ReCAPTCHA
                        ref={recaptchaSignUpRef}
                        size="invisible"
                        sitekey={recaptchaSiteKey}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow text-primary-foreground font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "Завантаження..." : "Зареєструватися"}
                  </Button>

                  {(telegramAuthEnabled && telegramBotUsername || googleOAuthEnabled) && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">або</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-center text-muted-foreground">
                          Швидка реєстрація через соцмережі
                        </p>
                        
                        {telegramAuthEnabled && telegramBotUsername && (
                          <TelegramLoginButton botUsername={telegramBotUsername} />
                        )}

                        {googleOAuthEnabled && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleAuth}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 border-2"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Зареєструватися через Google
                          </Button>
                        )}

                        <p className="text-xs text-center text-muted-foreground">
                          При першому вході запросить дозвіл на передачу ваших даних
                        </p>
                      </div>
                    </>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          <AlertDialog open={showTelegramDialog} onOpenChange={setShowTelegramDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Авторизація через Telegram
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-left">
                  <p>Для авторизації через Telegram виконайте наступні кроки:</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Натисніть кнопку "Відкрити бота"</li>
                    <li>В Telegram боті натисніть /start</li>
                    <li>Слідуйте інструкціям бота для завершення авторизації</li>
                  </ol>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowTelegramDialog(false)}
                  className="flex-1"
                >
                  Закрити
                </Button>
                <Button
                  onClick={() => {
                    window.open(`https://t.me/${telegramBotUsername.replace('@', '')}`, '_blank');
                  }}
                  className="flex-1 bg-gradient-primary hover:opacity-90"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Відкрити бота
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          <ForgotPasswordDialog
            open={showForgotPasswordDialog}
            onOpenChange={setShowForgotPasswordDialog}
          />


          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Реєструючись, ви погоджуєтесь з{" "}
              <Link to="/terms" className="text-primary hover:text-primary-glow transition-smooth underline">
                Угодою користувача
              </Link>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
