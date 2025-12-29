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
          {/* Bot Image - Smaller on mobile, larger on desktop */}
          <div className="flex-shrink-0">
            <img 
              src={authBotImage} 
              alt="Telegram Bot" 
              className="w-48 h-48 lg:w-80 lg:h-80 object-contain animate-scale-in"
              style={{ animationDuration: '0.6s' }}
            />
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
