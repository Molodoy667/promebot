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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      setSessionId(session.id);
      setExpiresAt(new Date(session.expires_at));
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
      
      const response = await supabase.functions.invoke('ai-chat-proxy', {
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
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося відправити повідомлення",
        variant: "destructive",
      });
    } finally {
      setSending(false);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (step === "selection") {
    if (!settings?.is_enabled) {
      return (
        <div className="container mx-auto px-4 py-8">
          <PageBreadcrumbs />
          <Button variant="ghost" onClick={() => navigate("/tools")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад до інструментів
          </Button>
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>AI Чат</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                AI чат наразі недоступний
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <PageBreadcrumbs />
        <PageHeader
          icon={MessageSquare}
          title="AI Чат"
          description="Спілкуйтеся з AI асистентом - отримуйте відповіді на запитання та допомогу в режимі реального часу"
          backTo="/tools"
          backLabel="Назад до інструментів"
        />

        <Card className="max-w-2xl mx-auto">
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground">
              Ви можете скористатись інструментом безкоштовно протягом{" "}
              {settings.free_duration_minutes} хвилин раз на{" "}
              {settings.free_cooldown_hours} годин, або орендувати його на {settings.rental_duration_minutes} хвилин за бонусні кошти.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => startSession("free")}
                disabled={!canUseFree}
                className="w-full"
                size="lg"
              >
                {canUseFree
                  ? "Спробувати Безкоштовно"
                  : `Спробуйте через ${getTimeUntilFree()}`}
              </Button>
              <Button
                onClick={() => startSession("rental")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Орендувати на {settings.rental_duration_minutes} хв за{" "}
                {isVip && vipDiscount > 0 ? (
                  <>
                    <span className="line-through mx-1">{settings.rental_price}</span>
                    <span className="font-bold">{(settings.rental_price * (1 - vipDiscount / 100)).toFixed(2)}</span>
                    <span className="ml-1">бонусних ₴ (VIP -{vipDiscount}%)</span>
                  </>
                ) : (
                  <span className="ml-1">{settings.rental_price} бонусних ₴</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chat view
  return (
    <div className="container mx-auto px-4 py-4 h-screen flex flex-col">
      <PageBreadcrumbs />
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate("/tools")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold">{formatTime(timeLeft)}</span>
        </div>
      </div>

      <Progress
        value={(timeLeft / ((settings?.rental_duration_minutes || 60) * 60)) * 100}
        className="h-2 mb-4"
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          {imagePreview && (
            <div className="relative w-20 h-20 mb-2">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover rounded"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
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
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишіть повідомлення..."
              className="min-h-[60px]"
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
  );
}
