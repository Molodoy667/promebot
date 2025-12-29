import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Image as ImageIcon, X, ArrowLeft, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
  created_at: string;
}

interface ChatSettings {
  rental_price: number;
  rental_duration_minutes: number;
  free_duration_minutes: number;
  free_cooldown_hours: number;
  is_enabled: boolean;
}

interface ActiveSession {
  id: string;
  session_type: "free" | "rental";
  expires_at: string;
}

export default function AIChat() {
  const [step, setStep] = useState<"loading" | "selection" | "chat">("loading");
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [canUseFree, setCanUseFree] = useState(false);
  const [nextFreeTime, setNextFreeTime] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<"free" | "rental">("free");
  const [sessionDuration, setSessionDuration] = useState(60); // в хвилинах
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [vipDiscount, setVipDiscount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (expiresAt) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeLeft(0);
          endSession();
        } else {
          setTimeLeft(Math.floor(diff / 1000));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const checkActiveSession = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        navigate("/login");
        return;
      }

      // Перевіряємо активну сесію
      const { data: activeSessions, error: sessionError } = await supabase
        .from("ai_chat_sessions")
        .select("*")
        .eq("user_id", user.user.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessionError) throw sessionError;

      if (activeSessions && activeSessions.length > 0) {
        // Є активна сесія - одразу переходимо в чат
        const session = activeSessions[0];
        setSessionId(session.id);
        setExpiresAt(new Date(session.expires_at));
        setSessionType(session.session_type as "free" | "rental");
        
        // Розраховуємо тривалість сесії
        const started = new Date(session.started_at);
        const expires = new Date(session.expires_at);
        const durationMs = expires.getTime() - started.getTime();
        setSessionDuration(Math.round(durationMs / (1000 * 60)));
        
        // Завантажуємо повідомлення
        await loadMessages(session.id);
        
        setStep("chat");
      } else {
        // Немає активної сесії - показуємо вибір
        await loadSettings();
        setStep("selection");
      }
    } catch (error) {
      console.error("Error checking session:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося перевірити сесію",
        variant: "destructive",
      });
      navigate("/tools");
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const normalized = (data || []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        image_url: m.image_url ?? undefined,
        created_at: m.created_at ?? new Date().toISOString(),
      }));

      setMessages(normalized);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Читаємо налаштування з tools_settings
      const { data: toolSettings } = await supabase
        .from("tools_settings")
        .select("*")
        .eq("tool_key", "ai_chat")
        .single();

      if (toolSettings) {
        setSettings({
          rental_price: toolSettings.price,
          rental_duration_minutes: toolSettings.rental_duration_minutes || 60,
          free_duration_minutes: toolSettings.free_duration_minutes || 10,
          free_cooldown_hours: toolSettings.free_cooldown_hours || 6,
          is_enabled: toolSettings.is_enabled,
        });
        
        // Зберігаємо VIP знижку
        if (toolSettings.vip_discount_enabled) {
          setVipDiscount(toolSettings.vip_discount_percent || 0);
        }
      }

      // Перевіряємо VIP статус
      const { data: vipData } = await supabase
        .from("vip_subscriptions")
        .select("expires_at")
        .eq("user_id", user.user.id)
        .gt("expires_at", new Date().toISOString())
        .single();
      
      setIsVip(!!vipData);

      const { data: canFree } = await supabase.rpc("can_start_free_ai_chat_session", {
        p_user_id: user.user.id,
      });

      setCanUseFree(canFree ?? false);

      const { data: nextTime } = await supabase.rpc("get_next_free_ai_chat_time", {
        p_user_id: user.user.id,
      });

      if (nextTime) {
        setNextFreeTime(new Date(nextTime));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const startSession = async (type: "free" | "rental") => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      if (type === "rental" && settings) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("bonus_balance")
          .eq("id", user.user.id)
          .single();

        // Отримуємо налаштування VIP знижки з tools_settings
        const { data: toolSettings } = await supabase
          .from("tools_settings")
          .select("vip_discount_enabled, vip_discount_percent")
          .eq("tool_key", "ai_chat")
          .single();

        // Розрахунок ціни з VIP знижкою
        let finalPrice = settings.rental_price;
        let discount = 0;
        
        if (isVip && toolSettings?.vip_discount_enabled) {
          const discountPercent = toolSettings.vip_discount_percent || 50;
          discount = settings.rental_price * (discountPercent / 100);
          finalPrice = settings.rental_price - discount;
        }

        if (!profile || profile.bonus_balance < finalPrice) {
          const vipText = isVip && toolSettings?.vip_discount_enabled 
            ? ` (VIP знижка -${toolSettings.vip_discount_percent}%)`
            : "";
          toast({
            title: "Недостатньо бонусних коштів",
            description: `Для оренди AI чату потрібно ${finalPrice.toFixed(2)} бонусних ₴${vipText}. Ваш баланс: ${profile?.bonus_balance?.toFixed(2) || 0} ₴`,
            variant: "destructive",
          });
          return;
        }

        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ bonus_balance: profile.bonus_balance - finalPrice })
          .eq("id", user.user.id);

        if (balanceError) throw balanceError;
        
        // Створюємо транзакцію
        const transactionDesc = isVip && toolSettings?.vip_discount_enabled
          ? `Оренда AI чату на ${settings.rental_duration_minutes} хвилин (VIP знижка -${toolSettings.vip_discount_percent}%: -${discount.toFixed(2)} ₴)`
          : `Оренда AI чату на ${settings.rental_duration_minutes} хвилин`;
          
        await supabase
          .from("transactions")
          .insert({
            user_id: user.user.id,
            amount: -finalPrice,
            type: "expense",
            description: transactionDesc,
            status: "completed",
          });
      }

      const durationMinutes =
        type === "free"
          ? settings?.free_duration_minutes || 10
          : settings?.rental_duration_minutes || 60;

      const expiresAtTime = new Date();
      expiresAtTime.setMinutes(expiresAtTime.getMinutes() + durationMinutes);

      const { data: session, error } = await supabase
        .from("ai_chat_sessions")
        .insert({
          user_id: user.user.id,
          session_type: type,
          expires_at: expiresAtTime.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Додаємо привітальне повідомлення
      const welcomeMessage = "Привіт! Радий вітати тебе 👋 Я твій AI-асистент і готовий допомогти з будь-якими питаннями. Чим можу бути корисним?";
      
      const { error: msgError } = await supabase
        .from("ai_chat_messages")
        .insert({
          session_id: session.id,
          user_id: user.user.id,
          role: "assistant",
          content: welcomeMessage,
        });

      if (msgError) {
        console.error("Error inserting welcome message:", msgError);
      }

      setSessionId(session.id);
      setExpiresAt(new Date(session.expires_at));
      setSessionType(type);
      setSessionDuration(durationMinutes);
      
      // Встановлюємо привітальне повідомлення в стейт
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: welcomeMessage,
        created_at: new Date().toISOString(),
      }]);
      
      setStep("chat");

      toast({
        title: "Сесію розпочато",
        description: `У вас є ${durationMinutes} хвилин для спілкування з AI`,
      });
    } catch (error) {
      console.error("Error starting session:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося розпочати сесію",
        variant: "destructive",
      });
    }
  };

  const endSession = async () => {
    if (!sessionId) return;

    try {
      await supabase
        .from("ai_chat_sessions")
        .update({ is_active: false })
        .eq("id", sessionId);

      toast({
        title: "Сесія завершена",
        description: "Час вичерпано",
      });

      navigate("/tools");
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || !sessionId || sending) return;

    setSending(true);
    setIsTyping(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      let imageUrl: string | null = null;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ai-chat-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("ai-chat-images")
          .getPublicUrl(uploadData.path);

        imageUrl = urlData.publicUrl;
      }

      const { data: userMessage, error: userError } = await supabase
        .from("ai_chat_messages")
        .insert({
          session_id: sessionId,
          user_id: user.user.id,
          role: "user",
          content: input,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (userError) throw userError;

      const normalizedUserMessage: Message = {
        id: userMessage.id,
        role: userMessage.role as "user" | "assistant",
        content: userMessage.content,
        image_url: userMessage.image_url ?? undefined,
        created_at: userMessage.created_at ?? new Date().toISOString(),
      };

      setMessages((prev) => [...prev, normalizedUserMessage]);
      setInput("");
      removeImage();

      const { data: aiService } = await supabase
        .from("ai_service_settings")
        .select("*")
        .eq("service_name", "ai_chat")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!aiService) {
        throw new Error("AI сервіс для чату не налаштований. Налаштуйте його в розділі 'AI Сервіси'");
      }

      // Use Edge Function proxy for automatic token generation
      const messageContent = imageUrl ? `${input}\n[Image: ${imageUrl}]` : input;

      // Передаємо access_token явно (у деяких середовищах invoke може не підхопити сесію)
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Сесію авторизації не знайдено. Будь ласка, увійдіть знову.");
      }

      const response = await supabase.functions.invoke('ai-chat-proxy', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            {
              role: "user",
              content: messageContent,
            },
          ],
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "AI API error");
      }

      const assistantContent = response.data?.content || "Помилка відповіді AI";

      const { data: assistantMessage, error: assistantError } = await supabase
        .from("ai_chat_messages")
        .insert({
          session_id: sessionId,
          user_id: user.user.id,
          role: "assistant",
          content: assistantContent,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      const normalizedAssistantMessage: Message = {
        id: assistantMessage.id,
        role: assistantMessage.role as "user" | "assistant",
        content: assistantMessage.content,
        image_url: assistantMessage.image_url ?? undefined,
        created_at: assistantMessage.created_at ?? new Date().toISOString(),
      };

      setMessages((prev) => [...prev, normalizedAssistantMessage]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMessage = error?.message || "Не вдалося відправити повідомлення";
      toast({
        title: "Помилка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSending(false);
      setIsTyping(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeUntilFree = () => {
    if (!nextFreeTime) return "";
    const now = new Date();
    const diff = nextFreeTime.getTime() - now.getTime();
    
    if (diff <= 0) return "Доступно зараз";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}г ${minutes}хв`;
  };

  if (step === "loading") {
    return (
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <PageBreadcrumbs />
        <PageHeader
          icon={MessageSquare}
          title="AI Чат"
          description="Спілкуйтеся з AI асистентом"
          backTo="/tools"
          backLabel="Назад до інструментів"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (step === "selection") {
    if (!settings?.is_enabled) {
      return (
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
          <PageBreadcrumbs />
          <PageHeader
            icon={MessageSquare}
            title="AI Чат"
            description="Спілкуйтеся з AI асистентом"
            backTo="/tools"
            backLabel="Назад до інструментів"
          />
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                AI чат наразі недоступний
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <PageBreadcrumbs />
        <PageHeader
          icon={MessageSquare}
          title="AI Чат"
          description="Спілкуйтеся з AI асистентом - отримуйте відповіді на запитання та допомогу"
          backTo="/tools"
          backLabel="Назад до інструментів"
        />

        <Card className="max-w-2xl mx-auto">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm md:text-base text-muted-foreground">
              Безкоштовно на {settings.free_duration_minutes} хв (раз на {settings.free_cooldown_hours} год) або орендуйте на {settings.rental_duration_minutes} хв.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => startSession("free")}
                disabled={!canUseFree}
                className="w-full text-sm md:text-base"
                size="lg"
              >
                {canUseFree
                  ? `Безкоштовно (${settings.free_duration_minutes} хв)`
                  : `Через ${getTimeUntilFree()}`}
              </Button>
              
              <Button
                onClick={() => startSession("rental")}
                variant="outline"
                className="w-full flex-wrap h-auto py-3 text-sm md:text-base"
              >
                <span className="w-full text-center">
                  Орендувати на {settings.rental_duration_minutes} хв
                </span>
                <span className="w-full text-center mt-1">
                  {isVip && vipDiscount > 0 ? (
                    <>
                      <span className="line-through text-muted-foreground mr-1">{settings.rental_price}</span>
                      <span className="font-bold">{(settings.rental_price * (1 - vipDiscount / 100)).toFixed(2)} ₴</span>
                      <span className="text-xs ml-1 text-primary">(VIP -{vipDiscount}%)</span>
                    </>
                  ) : (
                    <span className="font-semibold">{settings.rental_price} бонусних ₴</span>
                  )}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chat view
  const totalSeconds = sessionDuration * 60;
  const progressValue = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Compact header for chat */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/tools")}
              className="h-9 px-3"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Назад</span>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-semibold leading-tight">AI Чат</h1>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {sessionType === "free" ? "Безкоштовна сесія" : "Орендована сесія"}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-sm">
            <div className="text-right">
              <p className="text-lg md:text-xl font-bold tabular-nums leading-none">{formatTime(timeLeft)}</p>
              <p className="text-[10px] text-muted-foreground">{Math.ceil(timeLeft / 60)} / {sessionDuration} хв</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progressValue} className="h-1.5 mb-4" />

        {/* Chat card */}
        <Card className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
        <ScrollArea className="flex-1 p-3 md:p-4">
          <div className="space-y-3 md:space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-lg p-2.5 md:p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.image_url && (
                    <img
                      src={message.image_url}
                      alt="Attached"
                      className="rounded mb-2 max-w-full"
                    />
                  )}
                  <p className="whitespace-pre-wrap text-sm md:text-base">{message.content}</p>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">Бот печатає</span>
                  <span className="flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-3 md:p-4 border-t flex-shrink-0">
          {imagePreview && (
            <div className="relative w-16 h-16 md:w-20 md:h-20 mb-2">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover rounded"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 md:h-6 md:w-6"
                onClick={removeImage}
              >
                <X className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="flex-shrink-0 h-10 w-10 md:h-11 md:w-11"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишіть повідомлення..."
              className="min-h-[40px] max-h-[120px] text-sm md:text-base resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={sending}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={sending || (!input.trim() && !imageFile)}
              className="flex-shrink-0 h-10 w-10 md:h-11 md:w-11"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
}
