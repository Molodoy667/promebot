import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Image as ImageIcon, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIChatToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function AIChatTool({ open, onOpenChange }: AIChatToolProps) {
  const [step, setStep] = useState<"initial" | "chat">("initial");
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [canUseFree, setCanUseFree] = useState(false);
  const [nextFreeTime, setNextFreeTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<"free" | "rental">("free");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadSettings();
    } else {
      resetState();
    }
  }, [open]);

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

  const resetState = () => {
    setStep("initial");
    setSessionId(null);
    setSessionType("free");
    setMessages([]);
    setInput("");
    setImageFile(null);
    setImagePreview(null);
    setTimeLeft(0);
    setExpiresAt(null);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get settings
      const { data: settingsData } = await supabase
        .from("ai_chat_settings")
        .select("*")
        .limit(1)
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // Check if can use free
      const { data: canFree } = await supabase.rpc("can_start_free_ai_chat_session", {
        p_user_id: user.user.id,
      });

      setCanUseFree(canFree ?? false);

      // Get next free time
      const { data: nextTime } = await supabase.rpc("get_next_free_ai_chat_time", {
        p_user_id: user.user.id,
      });

      if (nextTime) {
        setNextFreeTime(new Date(nextTime));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (type: "free" | "rental") => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      if (type === "rental" && settings) {
        // Check balance
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user.user.id)
          .single();

        if (!profile || profile.balance < settings.rental_price) {
          toast({
            title: "Недостатньо коштів",
            description: "Поповніть баланс для оренди AI чату",
            variant: "destructive",
          });
          return;
        }

        // Deduct balance
        const { error: balanceError } = await supabase
          .from("profiles")
          .update({ balance: profile.balance - settings.rental_price })
          .eq("id", user.user.id);

        if (balanceError) throw balanceError;
      }

      const durationMinutes =
        type === "free"
          ? settings?.free_duration_minutes || 10
          : settings?.rental_duration_minutes || 60;

      const expiresAtTime = new Date();
      expiresAtTime.setMinutes(expiresAtTime.getMinutes() + durationMinutes);

      // Create session
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
      setSessionType(type);
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
      const { data: { user } } = await supabase.auth.getUser();

      // Закриваємо сесію лише якщо вона ще активна (щоб не дублювати сповіщення)
      const { data: endedRows, error: endError } = await supabase
        .from("ai_chat_sessions")
        .update({ is_active: false })
        .eq("id", sessionId)
        .eq("is_active", true)
        .select("id");

      if (endError) throw endError;

      if (user && endedRows && endedRows.length > 0) {
        const sessionLabel = sessionType === "free" ? "безкоштовна" : "орендована";

        try {
          await supabase.rpc("create_notification", {
            p_user_id: user.id,
            p_type: "system",
            p_title: "AI Чат: сесія завершена",
            p_message: `Ваша ${sessionLabel} сесія AI чату завершилась. Час вичерпано. Ви можете розпочати нову сесію в інструментах.`,
            p_link: "/tools",
          });
        } catch (notifError) {
          console.error("Could not create session expiration notification:", notifError);
        }
      }

      toast({
        title: "Сесія завершена",
        description: "Час вичерпано",
      });

      onOpenChange(false);
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

      // Upload image if exists
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

      // Save user message
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

      // Get AI service
      const { data: aiService } = await supabase
        .from("ai_service_settings")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!aiService) {
        throw new Error("AI сервіс не налаштований");
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

      // Save assistant message
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

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Чат</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!settings?.is_enabled) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Чат</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground py-8">
            AI чат наразі недоступний
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        {step === "initial" ? (
          <>
            <DialogHeader className="p-6 pb-4">
              <DialogTitle>AI Чат</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <p className="text-muted-foreground">
                Ви можете скористатись інструментом безкоштовно протягом{" "}
                {settings.free_duration_minutes} хвилин раз на{" "}
                {settings.free_cooldown_hours} годин, або орендувати його на годину.
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
                  Орендувати на годину за ${settings.rental_price}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="flex items-center justify-between">
                <span>AI Чат</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {formatTime(timeLeft)}
                </span>
              </DialogTitle>
              <Progress
                value={(timeLeft / ((settings.rental_duration_minutes || 60) * 60)) * 100}
                className="h-1 mt-2"
              />
            </DialogHeader>

            <ScrollArea className="flex-1 p-4 h-[400px]">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
