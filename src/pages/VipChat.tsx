import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Send, ImagePlus, Smile, X, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface Message {
  id: string;
  user_id: string;
  message: string;
  attachment_url?: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    telegram_photo_url: string | null;
  };
}

interface OnlineUser {
  user_id: string;
  online_at: string;
}

export default function VipChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isVip && user) {
      loadMessages();
      const unsubscribe = subscribeToMessages();
      setupPresence();
      return unsubscribe;
    }
  }, [isVip, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAuth = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      navigate("/auth");
      return;
    }

    setUser(authUser);

    // Check VIP status
    const { data: vipData } = await supabase
      .from("vip_subscriptions")
      .select("expires_at")
      .eq("user_id", authUser.id)
      .single();

    if (!vipData || new Date(vipData.expires_at) < new Date()) {
      setIsVip(false);
      setLoading(false);
      toast({ title: "Помилка", description: "У вас немає активного VIP статусу", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    setIsVip(true);
    setLoading(false);
  };

  const loadMessages = async () => {
    try {
      const { data: messages, error } = await supabase
        .from("vip_chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      // Load profiles separately
      if (messages && messages.length > 0) {
        const userIds = [...new Set(messages.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, telegram_photo_url")
          .in("id", userIds);

        const messagesWithProfiles = messages.map(msg => ({
          ...msg,
          profiles: profiles?.find(p => p.id === msg.user_id) || null
        }));

        setMessages(messagesWithProfiles as any);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({ title: "Помилка", description: "Помилка завантаження повідомлень", variant: "destructive" });
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel("vip_chat_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vip_chat_messages",
        },
        async (payload) => {
          // Load profile for new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, telegram_photo_url")
            .eq("id", payload.new.user_id)
            .single();

          const newMessage: Message = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            message: payload.new.message,
            attachment_url: payload.new.attachment_url,
            created_at: payload.new.created_at,
            profiles: profile || undefined
          };

          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const setupPresence = () => {
    const presenceChannel = supabase.channel('vip_online_users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online: OnlineUser[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id) {
              online.push({
                user_id: presence.user_id,
                online_at: presence.online_at
              });
            }
          });
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Помилка", description: "Файл занадто великий. Максимум 5 МБ", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Помилка", description: "Можна завантажувати тільки зображення", variant: "destructive" });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !user) return null;

    try {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("vip-chat")
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("vip-chat")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    setUploading(true);
    try {
      let attachmentUrl = null;
      if (selectedImage) {
        attachmentUrl = await uploadImage();
      }

      const { error } = await supabase
        .from("vip_chat_messages")
        .insert({
          user_id: user.id,
          message: newMessage.trim() || "",
          attachment_url: attachmentUrl,
        });

      if (error) throw error;

      setNewMessage("");
      removeImage();
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Помилка", description: "Помилка відправки повідомлення", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  if (loading) {
    return <Loading message="Завантаження VIP чату..." />;
  }

  if (!isVip) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="p-4 max-w-4xl mx-auto">
        <PageHeader
          icon={Crown}
          title="VIP Чат"
          description="Ексклюзивний чат для VIP користувачів - спілкуйтеся з іншими VIP-членами спільноти"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg mt-4">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-primary font-semibold">{onlineUsers.length}</span>
            <span className="text-muted-foreground text-sm">користувачів онлайн</span>
          </div>
        </PageHeader>
        
        <div className="glass-effect rounded-xl shadow-card border border-amber-500/20 overflow-hidden">

          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-background">
            {messages.map((msg) => {
              const isOwnMessage = msg.user_id === user?.id;
              const avatar = msg.profiles?.telegram_photo_url || msg.profiles?.avatar_url;
              const name = msg.profiles?.full_name || "VIP Користувач";

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                >
                  <div className="flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="h-10 w-10 rounded-full border-2 border-amber-500/30"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center border-2 border-amber-500/30">
                        <Crown className="h-5 w-5 text-amber-600" />
                      </div>
                    )}
                  </div>
                  <div className={`flex-1 max-w-[70%]`}>
                    <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                      <Crown className="h-3 w-3 text-amber-600" />
                      <p className="text-sm font-semibold text-foreground">{name}</p>
                    </div>
                    <div
                      className={`inline-block px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? "bg-gradient-primary text-primary-foreground"
                          : "glass-effect border border-amber-500/20 text-foreground"
                      }`}
                    >
                      {msg.attachment_url && (
                        <img 
                          src={msg.attachment_url} 
                          alt="Attachment" 
                          className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.attachment_url!, '_blank')}
                        />
                      )}
                      {msg.message && <p className="break-words">{msg.message}</p>}
                    </div>
                    <p className={`text-xs text-muted-foreground mt-1 ${isOwnMessage ? "text-right" : ""}`}>
                      {new Date(msg.created_at).toLocaleTimeString("uk-UA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-card border-t border-amber-500/20">
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-h-32 rounded-lg border-2 border-amber-500/30"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {showEmojiPicker && (
              <div className="mb-3">
                <EmojiPicker 
                  onEmojiClick={onEmojiClick}
                  width="100%"
                  height={350}
                />
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="border-amber-500/30 hover:border-amber-500"
                disabled={uploading}
              >
                <ImagePlus className="h-5 w-5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="border-amber-500/30 hover:border-amber-500"
                disabled={uploading}
              >
                <Smile className="h-5 w-5" />
              </Button>

              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Напишіть повідомлення..."
                className="flex-1 border-amber-500/30 focus:border-amber-500"
                disabled={uploading}
              />
              
              <Button
                onClick={sendMessage}
                disabled={(!newMessage.trim() && !selectedImage) || uploading}
                className="bg-gradient-primary hover:opacity-90 shadow-glow"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

