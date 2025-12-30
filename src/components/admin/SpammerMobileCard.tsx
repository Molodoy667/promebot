import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Trash2, Loader2, Check, X, AlertCircle, Zap, FileText, Lock } from "lucide-react";

interface TelegramSpammer {
  id: string;
  user_id: string;
  name: string;
  phone_number: string | null;
  tdata_path: string;
  authkey: string | null;
  is_active: boolean;
  is_authorized: boolean;
  last_activity_at: string | null;
  last_error: string | null;
  error_count: number;
  messages_sent: number;
  created_at: string;
}

interface SpammerMobileCardProps {
  spammer: TelegramSpammer;
  onDelete: (id: string) => void;
  onTest: (spammer: TelegramSpammer) => void;
  isTesting?: boolean;
}

export const SpammerMobileCard = ({ spammer, onDelete, onTest, isTesting }: SpammerMobileCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">{spammer.name}</h3>
                {spammer.phone_number && (
                  <p className="text-sm text-muted-foreground">{spammer.phone_number}</p>
                )}
              </div>
            </div>
            <Badge 
              variant={spammer.is_active ? "default" : "outline"}
              className={spammer.is_active ? "bg-success/20 text-success border-success/30" : ""}
            >
              {spammer.is_active ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
              {spammer.is_active ? "Активний" : "Неактивний"}
            </Badge>
          </div>

          <Separator />

          {/* TData Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">TData</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{spammer.tdata_path.slice(0, 20)}...</code>
            </div>
            {spammer.authkey && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">AuthKey</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{spammer.authkey.slice(0, 16)}...</code>
              </div>
            )}
          </div>

          <Separator />

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Авторизація</span>
            {spammer.is_authorized ? (
              <Badge className="bg-success/20 text-success border-success/30 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Авторизовано
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <X className="w-3 h-3 mr-1" />
                Не авторизовано
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Надіслано повідомлень</p>
                <p className="text-lg font-semibold">{spammer.messages_sent}</p>
              </div>
            </div>
          </div>

          {/* Errors */}
          {spammer.error_count > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-destructive">Помилок: {spammer.error_count}</p>
                {spammer.last_error && (
                  <p className="text-xs text-muted-foreground truncate">{spammer.last_error}</p>
                )}
              </div>
            </div>
          )}

          {/* Last Activity */}
          {spammer.last_activity_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Остання активність</span>
              <span className="text-xs text-muted-foreground">
                {new Date(spammer.last_activity_at).toLocaleDateString("uk-UA", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {!spammer.is_authorized && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTest(spammer)}
                disabled={isTesting}
                className="w-full col-span-2 border-primary/30 hover:bg-primary/10"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Авторизувати
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(spammer)}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Тест
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(spammer.id)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Видалити
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
