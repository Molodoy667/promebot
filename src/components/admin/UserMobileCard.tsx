import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Shield, Crown, Mail, Calendar, Wallet, Gift, User } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  balance: number;
  bonus_balance: number;
  phone: string | null;
  referral_code: string | null;
  created_at: string;
}

interface UserMobileCardProps {
  user: User;
  onEdit: (user: User) => void;
  onManageRole: (user: User) => void;
  onManageVip: (user: User) => void;
}

export const UserMobileCard = ({ user, onEdit, onManageRole, onManageVip }: UserMobileCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Card className="glass-effect border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-4 space-y-3">
        {/* Header - User Info */}
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 border-2 border-border">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10">
              <User className="w-6 h-6 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-base truncate">
              {user.full_name || "Без імені"}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Balance Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span>Основний</span>
            </div>
            <p className="text-sm font-semibold">{user.balance.toFixed(2)} ₴</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gift className="w-3.5 h-3.5" />
              <span>Бонусний</span>
            </div>
            <p className="text-sm font-semibold text-primary">{user.bonus_balance.toFixed(2)} ₴</p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2">
          {user.referral_code && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Реферальний код:</span>
              <Badge variant="outline" className="font-mono">
                {user.referral_code}
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Реєстрація: {formatDate(user.created_at)}</span>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="w-full"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageRole(user)}
            className="w-full"
          >
            <Shield className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageVip(user)}
            className="w-full"
          >
            <Crown className="w-4 h-4 text-amber-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
