import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { MessageItem } from "@/components/MessageItem";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, X, Plus, Paperclip } from "lucide-react";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
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
  full_name: string;
  avatar_url: string | null;
}

export const TicketsManagement = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, Profile>>({});
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; preview: string; progress: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    loadCurrentUser();
    loadTickets();
  }, [filterStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime підписки
  useEffect(() => {
    const ticketsChannel = supabase
      .channel('admin_tickets_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;

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
        () => {
          loadTicketDetails(selectedTicket.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedTicket?.id]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadTickets = async () => {
    try {
      let query = supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTickets(data || []);

      // Load user profiles
      const userIds = [...new Set(data?.map((t) => t.user_id) || [])];
      const profilesMap: Record<string, Profile> = {};
      const rolesMap: Record<string, string> = {};

      for (const userId of userIds) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name, avatar_url")
          .eq("id", userId)
          .single();

        if (profile) {
          profilesMap[userId] = profile;
        }

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .neq("role", "user");

        if (roles && roles.length > 0) {
          rolesMap[userId] = roles[0].role;
        }
      }

      setUserProfiles(profilesMap);
      setUserRoles(rolesMap);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити тікети",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

      // Load profiles
      const userIds = [...new Set(messagesData?.map((m) => m.user_id) || [])];
      const profilesMap = { ...userProfiles };
      const rolesMap = { ...userRoles };

      for (const userId of userIds) {
        if (!profilesMap[userId]) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name, avatar_url")
            .eq("id", userId)
            .single();

          if (profile) {
            profilesMap[userId] = profile;
          }

          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .neq("role", "user");

          if (roles && roles.length > 0) {
            rolesMap[userId] = roles[0].role;
          }
        }
      }

      setUserProfiles(profilesMap);
      setUserRoles(rolesMap);
    } catch (error) {
      console.error("Error loading ticket details:", error);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string, assignToSelf: boolean = false) => {
    try {
      const updateData: any = { status };
      
      if (status === "in_progress" && assignToSelf) {
        updateData.assigned_to = currentUserId;
      }

      const { error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Статус оновлено",
      });

      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status, assigned_to: assignToSelf ? currentUserId : selectedTicket.assigned_to });
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити статус",
        variant: "destructive",
      });
    }
  };

  const takeTicket = async (ticketId: string) => {
    await updateTicketStatus(ticketId, "in_progress", true);
  };

  const sendAdminReply = async () => {
    if (!selectedTicket || (!newMessage.trim() && uploadedFiles.length === 0)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: messageData, error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newMessage || "📎 Файл",
          is_admin_reply: true,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload attachments
      for (let i = 0; i < uploadedFiles.length; i++) {
        const fileData = uploadedFiles[i];
        const filePath = `admin/${selectedTicket.id}/${Date.now()}_${fileData.file.name}`;
        
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
        description: "Відповідь надіслано",
      });
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати відповідь",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      open: "default" as const,
      in_progress: "secondary" as const,
      closed: "outline" as const,
    };
    const labels = {
      open: "Відкритий",
      in_progress: "В роботі",
      closed: "Закритий",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants]} className="backdrop-blur-xl">
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const classNames = {
      low: "bg-success/20 text-success border border-success/30 backdrop-blur-xl",
      medium: "bg-primary/20 text-primary border border-primary/30 backdrop-blur-xl",
      high: "bg-warning/20 text-warning border border-warning/30 backdrop-blur-xl",
      urgent: "bg-destructive/30 text-destructive border border-destructive/30 backdrop-blur-xl",
    };
    const labels = {
      low: "Низький",
      medium: "Середній",
      high: "Високий",
      urgent: "Терміновий",
    };
    return (
      <Badge className={classNames[priority as keyof typeof classNames]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getUserRole = (userId: string, isAdminReply: boolean) => {
    if (isAdminReply) {
      const role = userRoles[userId];
      if (role === "admin") return "Адміністратор";
      if (role === "moderator") return "Модератор";
      return "Підтримка";
    }
    return userProfiles[userId]?.full_name || "Користувач";
  };

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {selectedTicket ? (
        <div className="flex-1 flex flex-col overflow-hidden glass-effect rounded-lg border border-border/50">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">{selectedTicket.subject}</h2>
              <div className="flex gap-2 items-center">
                {selectedTicket.status === "open" && !selectedTicket.assigned_to && (
                  <Button
                    onClick={() => takeTicket(selectedTicket.id)}
                    size="sm"
                    className="bg-gradient-primary"
                  >
                    Взяти в роботу
                  </Button>
                )}
                <Select
                  value={selectedTicket.status}
                  onValueChange={(value) => updateTicketStatus(selectedTicket.id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Відкритий</SelectItem>
                    <SelectItem value="in_progress">В роботі</SelectItem>
                    <SelectItem value="closed">Закритий</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="flex gap-2 items-center">
              {getStatusBadge(selectedTicket.status)}
              {getPriorityBadge(selectedTicket.priority)}
              {selectedTicket.assigned_to && (
                <Badge variant="outline" className="text-xs">
                  Призначено: {userProfiles[selectedTicket.assigned_to]?.full_name || userProfiles[selectedTicket.assigned_to]?.email}
                </Badge>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => {
                const profile = userProfiles[msg.user_id];
                const isOwnMessage = false; // Admin never sees their own messages as "own"
                
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
                      sendAdminReply();
                    }
                  }}
                  placeholder="Напишіть відповідь..."
                  rows={1}
                  className="flex-1 resize-none min-h-[40px] max-h-32"
                />
                
                <Button
                  onClick={sendAdminReply}
                  size="icon"
                  className="rounded-full flex-shrink-0 bg-gradient-primary"
                  disabled={!newMessage.trim() && uploadedFiles.length === 0}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
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

          {/* Tickets list */}
          <div className="grid gap-4">
            {tickets.length === 0 ? (
              <Card className="p-8 text-center glass-effect border-border/50">
                <p className="text-muted-foreground">Немає тікетів</p>
              </Card>
            ) : (
              tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="p-4 hover:bg-accent cursor-pointer transition-colors glass-effect border-border/50"
                  onClick={() => {
                    setSelectedTicket(ticket);
                    loadTicketDetails(ticket.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={userProfiles[ticket.user_id]?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {userProfiles[ticket.user_id]?.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          {userProfiles[ticket.user_id]?.full_name || userProfiles[ticket.user_id]?.email}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {ticket.description}
                      </p>
                      {ticket.assigned_to && (
                        <Badge variant="outline" className="text-xs">
                          Призначено: {userProfiles[ticket.assigned_to]?.full_name || userProfiles[ticket.assigned_to]?.email}
                        </Badge>
                      )}
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
    </div>
  );
};