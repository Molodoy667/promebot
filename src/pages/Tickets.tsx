import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Paperclip, Send, X, Image as ImageIcon, TicketIcon } from "lucide-react";
import { MessageItem } from "@/components/MessageItem";
import { Progress } from "@/components/ui/progress";
import { Loading } from "@/components/Loading";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  unread_admin_replies: number;
}

interface TicketMessage {
  id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  user_id: string;
}

interface Profile {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

const Tickets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; preview: string; progress: number }>>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Reload tickets when filter changes
  useEffect(() => {
    if (user?.id) {
      loadTickets(user.id);
    }
  }, [filterStatus, user?.id]);

  // Subscribe to ticket updates for realtime list refresh
  useEffect(() => {
    if (!user?.id) return;

    const ticketSubscription = supabase
      .channel('user_tickets_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTickets(user.id);
        }
      )
      .subscribe();

    return () => {
      ticketSubscription.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await loadTickets(session.user.id);
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTickets = async (userId: string) => {
    try {
      let query = supabase
        .from("tickets")
        .select("*")
        .eq("user_id", userId);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити тікети",
        variant: "destructive",
      });
    }
  };

  const closeTicket = async () => {
    if (!selectedTicket || !user) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: "closed" })
        .eq("id", selectedTicket.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Тікет закрито",
      });

      setSelectedTicket({ ...selectedTicket, status: "closed" });
      await loadTickets(user.id);
    } catch (error) {
      console.error("Error closing ticket:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося закрити тікет",
        variant: "destructive",
      });
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      setMessages(messagesData || []);

      // Mark ticket as read - скидаємо лічильник
      await supabase.rpc('mark_ticket_as_read', { ticket_id: ticketId });
      
      // Оновлюємо список тікетів щоб побачити зміни
      if (user) {
        await loadTickets(user.id);
      }

      // Load profiles
      const userIds = [...new Set(messagesData?.map((m) => m.user_id) || [])];
      const profilesMap: Record<string, Profile> = {};

      for (const userId of userIds) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .eq("id", userId)
          .single();

        if (profile) {
          profilesMap[userId] = profile;
        }
      }

      setProfiles(profilesMap);
    } catch (error) {
      console.error("Error loading ticket details:", error);
    }
  };

  // Real-time updates for ticket messages when a ticket is selected
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const messagesChannel = supabase
      .channel(`ticket_messages_${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        async (payload) => {
          console.log('Ticket message changed:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Load profile for new message
            const { data: profile } = await supabase
              .from("profiles")
              .select("email, full_name, avatar_url")
              .eq("id", payload.new.user_id)
              .single();

            if (profile) {
              setProfiles(prev => ({
                ...prev,
                [payload.new.user_id]: profile
              }));
            }

            setMessages(prev => [...prev, payload.new as TicketMessage]);
          } else {
            // For UPDATE or DELETE, reload all messages
            loadTicketDetails(selectedTicket.id);
          }
        }
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [selectedTicket?.id]);

  const sendMessage = async () => {
    if (!user || !selectedTicket || (!newMessage.trim() && uploadedFiles.length === 0)) return;

    try {
      const { data: messageData, error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newMessage || "📎 Файл",
          is_admin_reply: false,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload attachments with progress
      for (let i = 0; i < uploadedFiles.length; i++) {
        const fileData = uploadedFiles[i];
        const filePath = `${user.id}/${selectedTicket.id}/${Date.now()}_${fileData.file.name}`;
        
        // Update progress
        setUploadedFiles(prev => {
          const newFiles = [...prev];
          newFiles[i] = { ...newFiles[i], progress: 50 };
          return newFiles;
        });

        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, fileData.file);

        if (!uploadError) {
          await supabase.from("ticket_attachments").insert({
            ticket_id: selectedTicket.id,
            message_id: messageData.id,
            file_name: fileData.file.name,
            file_path: filePath,
            file_size: fileData.file.size,
          });

          // Update progress to complete
          setUploadedFiles(prev => {
            const newFiles = [...prev];
            newFiles[i] = { ...newFiles[i], progress: 100 };
            return newFiles;
          });
        }
      }

      setNewMessage("");
      setUploadedFiles([]);
      setShowAttachMenu(false);
      await loadTicketDetails(selectedTicket.id);

      toast({
        title: "Успішно",
        description: "Повідомлення надіслано",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати повідомлення",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      open: "bg-blue-500",
      in_progress: "bg-yellow-500",
      closed: "bg-gray-500",
    };
    const labels = {
      open: "Відкритий",
      in_progress: "В роботі",
      closed: "Закритий",
    };
    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-500",
      medium: "bg-blue-500",
      high: "bg-orange-500",
      urgent: "bg-red-500",
    };
    const labels = {
      low: "Низький",
      medium: "Середній",
      high: "Високий",
      urgent: "Терміновий",
    };
    return (
      <Badge className={colors[priority as keyof typeof colors]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getUserRole = (userId: string, isAdminReply: boolean) => {
    if (isAdminReply) return "Підтримка";
    if (user && userId === user.id) return "Ви";
    return "Користувач";
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageBreadcrumbs />
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col overflow-hidden">
        <PageHeader
          icon={TicketIcon}
          title="Тікети підтримки"
          description="Створюйте тікети для отримання допомоги від команди підтримки"
        >
          {!selectedTicket && (
            <Button
              onClick={() => navigate("/tickets/create")}
              size="lg"
              className="bg-gradient-primary hover:opacity-90 mt-4"
            >
              <Plus className="w-5 h-5 mr-2" />
              Створити новий тікет
            </Button>
          )}
        </PageHeader>

        {selectedTicket ? (
          <div className="flex-1 flex flex-col overflow-hidden glass-effect rounded-lg border border-border/50">
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
                <div className="flex gap-2">
                  {selectedTicket.status !== "closed" && (
                    <Button
                      variant="outline"
                      onClick={closeTicket}
                      className="text-destructive hover:text-destructive"
                    >
                      Закрити тікет
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{selectedTicket.description}</p>
              <div className="flex gap-2">
                {getStatusBadge(selectedTicket.status)}
                {getPriorityBadge(selectedTicket.priority)}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => {
                const profile = profiles[msg.user_id];
                const isOwnMessage = user && msg.user_id === user.id && !msg.is_admin_reply;
                
                return (
                  <MessageItem
                    key={msg.id}
                    msg={msg}
                    profile={profile}
                    isOwnMessage={isOwnMessage}
                    getUserRole={getUserRole}
                  />
                );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            {selectedTicket.status !== "closed" && (
              <div className="p-4 border-t">
                {uploadedFiles.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {uploadedFiles.map((fileData, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                          <img
                            src={fileData.preview}
                            alt={fileData.file.name}
                            className="w-full h-full object-cover"
                          />
                          {fileData.progress > 0 && fileData.progress < 100 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-3/4">
                                <Progress value={fileData.progress} className="h-1" />
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setUploadedFiles(files => {
                              const newFiles = [...files];
                              URL.revokeObjectURL(newFiles[index].preview);
                              newFiles.splice(index, 1);
                              return newFiles;
                            });
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                          <p className="text-xs text-white truncate">{fileData.file.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-end gap-2">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="rounded-full"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                    
                    {showAttachMenu && (
                      <Card className="absolute bottom-full mb-2 left-0 p-2 shadow-lg glass-effect border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleFileSelect}
                          className="w-full justify-start gap-2"
                        >
                          <Paperclip className="w-4 h-4" />
                          Прикріпити файл
                        </Button>
                      </Card>
                    )}
                  </div>
                  
                  <Input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files).map(file => ({
                          file,
                          preview: URL.createObjectURL(file),
                          progress: 0,
                        }));
                        setUploadedFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                    className="hidden"
                  />
                  
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Напишіть повідомлення..."
                    rows={1}
                    className="flex-1 resize-none min-h-[40px] max-h-32"
                  />
                  
                  <Button
                    onClick={sendMessage}
                    size="icon"
                    className="rounded-full flex-shrink-0"
                    disabled={!newMessage.trim() && uploadedFiles.length === 0}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Filters */}
            <div className="mb-4 flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                size="sm"
              >
                Всі
              </Button>
              <Button
                variant={filterStatus === "open" ? "default" : "outline"}
                onClick={() => setFilterStatus("open")}
                size="sm"
              >
                Відкриті
              </Button>
              <Button
                variant={filterStatus === "in_progress" ? "default" : "outline"}
                onClick={() => setFilterStatus("in_progress")}
                size="sm"
              >
                В роботі
              </Button>
              <Button
                variant={filterStatus === "closed" ? "default" : "outline"}
                onClick={() => setFilterStatus("closed")}
                size="sm"
              >
                Закриті
              </Button>
            </div>

            <div className="grid gap-4">{tickets.length === 0 ? (
                <Card className="p-8 text-center glass-effect border-border/50">
                  <p className="text-muted-foreground">
                    У вас поки немає тікетів. Створіть новий тікет, щоб зв'язатися з підтримкою.
                  </p>
                </Card>
              ) : (
                tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="p-4 hover:bg-accent cursor-pointer transition-colors relative glass-effect border-border/50"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      loadTicketDetails(ticket.id);
                    }}
                  >
                    {ticket.unread_admin_replies > 0 && (
                      <span className="absolute top-4 right-4 w-3 h-3 bg-warning rounded-full animate-pulse" />
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                          {ticket.unread_admin_replies > 0 && (
                            <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                              {ticket.unread_admin_replies} нових
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {ticket.description}
                        </p>
                        <div className="flex gap-2">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("uk-UA")}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Tickets;
