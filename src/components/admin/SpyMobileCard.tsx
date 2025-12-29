import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Trash2, Loader2, Check, X, Radio, AlertCircle, Zap } from "lucide-react";

interface TelegramSpy {
  id: string;
  user_id: string;
  api_id: string;
  api_hash: string;
  phone_number: string | null;
  name: string | null;
  is_active: boolean;
  channels_monitored: number;
  last_activity_at: string | null;
  created_at: string;
  session_string: string | null;
  is_authorized: boolean;
  last_error: string | null;
  error_count: number;
}

interface SpyMobileCardProps {
  spy: TelegramSpy;
  onDelete: (id: string) => void;
  onTest: (spy: TelegramSpy) => void;
  onAuth: (spy: TelegramSpy) => void;
  isTesting?: boolean;
}

export const SpyMobileCard = ({ spy, onDelete, onTest, onAuth, isTesting }: SpyMobileCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">{spy.name || "Userbot"}</h3>
                {spy.phone_number && (
                  <p className="text-sm text-muted-foreground">{spy.phone_number}</p>
                )}
              </div>
            </div>
            <Badge 
              variant={spy.is_active ? "default" : "outline"}
              className={spy.is_active ? "bg-success/20 text-success border-success/30" : ""}
            >
              {spy.is_active ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
              {spy.is_active ? "Активний" : "Неактивний"}
            </Badge>
          </div>

          <Separator />

          {/* API Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API ID</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{spy.api_id}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API Hash</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{spy.api_hash.slice(0, 8)}...</code>
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Авторизація</span>
            {spy.is_authorized ? (
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
              <Radio className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Моніторинг каналів</p>
                <p className="text-lg font-semibold">{spy.channels_monitored}</p>
              </div>
            </div>
          </div>

          {/* Errors */}
          {spy.error_count > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-destructive">Помилок: {spy.error_count}</p>
                {spy.last_error && (
                  <p className="text-xs text-muted-foreground truncate">{spy.last_error}</p>
                )}
              </div>
            </div>
          )}

          {/* Last Activity */}
          {spy.last_activity_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Остання активність</span>
              <span className="text-xs text-muted-foreground">
                {new Date(spy.last_activity_at).toLocaleDateString("uk-UA", {
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
            {!spy.is_authorized && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAuth(spy)}
                className="w-full col-span-2 border-primary/30 hover:bg-primary/10"
              >
                <Zap className="w-4 h-4 mr-2" />
                Авторизувати
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(spy)}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Тест
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(spy.id)}
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
