import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface MessageItemProps {
  msg: {
    id: string;
    message: string;
    is_admin_reply: boolean;
    created_at: string;
    user_id: string;
  };
  profile: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | undefined;
  isOwnMessage: boolean;
  getUserRole: (userId: string, isAdminReply: boolean) => string;
}

export const MessageItem = ({ msg, profile, isOwnMessage, getUserRole }: MessageItemProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const loadAttachments = async () => {
      const { data } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("message_id", msg.id);

      if (data) {
        const attachmentsWithUrls = await Promise.all(
          data.map(async (att) => {
            const { data: urlData } = await supabase.storage
              .from("ticket-attachments")
              .createSignedUrl(att.file_path, 3600);
            return { ...att, url: urlData?.signedUrl };
          })
        );
        setAttachments(attachmentsWithUrls);
      }
    };
    loadAttachments();
  }, [msg.id]);

  return (
    <div
      className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
    >
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback className={msg.is_admin_reply ? "bg-primary text-primary-foreground" : "bg-muted"}>
          {msg.is_admin_reply ? "П" : (profile?.full_name?.[0] || "U")}
        </AvatarFallback>
      </Avatar>

      <div className={`flex-1 max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">
            {getUserRole(msg.user_id, msg.is_admin_reply)}
          </span>
          {msg.is_admin_reply && (
            <Badge variant="outline" className="text-xs">Адмін</Badge>
          )}
        </div>

        <div
          className={`rounded-2xl px-4 py-2 backdrop-blur-md border border-border/30 ${
            isOwnMessage
              ? "bg-primary/80 text-primary-foreground shadow-lg"
              : "bg-muted/60 shadow-md"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>

          {attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {attachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => window.open(att.url, '_blank')}
                  className="block w-full max-w-xs rounded-lg overflow-hidden hover:opacity-90 transition-opacity cursor-pointer border-2 border-border/50"
                >
                  <img
                    src={att.url}
                    alt={att.file_name}
                    className="w-full h-auto object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-xs text-muted-foreground mt-1 block">
          {new Date(msg.created_at).toLocaleString("uk-UA", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};
