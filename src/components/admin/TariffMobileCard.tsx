import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2, Check, X, DollarSign, Calendar, Radio, FileText, Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Tariff {
  id: string;
  name: string;
  description: string | null;
  price: number;
  channels_limit: number;
  posts_per_month: number;
  sources_limit?: number;
  features: string[] | null;
  is_active: boolean;
  bots_limit?: number;
  duration_days?: number | null;
}

interface TariffMobileCardProps {
  tariff: Tariff;
  onEdit: (tariff: Tariff) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
}

export const TariffMobileCard = ({ tariff, onEdit, onDelete, onToggleActive }: TariffMobileCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{tariff.name}</h3>
              {tariff.description && (
                <p className="text-sm text-muted-foreground mt-1">{tariff.description}</p>
              )}
            </div>
            <Badge 
              variant={tariff.is_active ? "default" : "outline"}
              className={tariff.is_active ? "bg-success/20 text-success border-success/30" : ""}
            >
              {tariff.is_active ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
              {tariff.is_active ? "Активний" : "Неактивний"}
            </Badge>
          </div>

          <Separator />

          {/* Price */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Ціна</span>
            </div>
            <span className="text-xl font-bold text-primary">{tariff.price} ₴</span>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Каналів</span>
              </div>
              <p className="text-lg font-semibold">{tariff.channels_limit}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Постів/міс</span>
              </div>
              <p className="text-lg font-semibold">{tariff.posts_per_month}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ботів</span>
              </div>
              <p className="text-lg font-semibold">{tariff.bots_limit || 1}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Днів</span>
              </div>
              <p className="text-lg font-semibold">{tariff.duration_days || "∞"}</p>
            </div>
          </div>

          <Separator />

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
            <span className="text-sm font-medium">Активний</span>
            <Switch
              checked={tariff.is_active}
              onCheckedChange={() => onToggleActive(tariff.id, tariff.is_active)}
            />
          </div>

          <Separator />

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(tariff)}
              className="w-full"
            >
              <Edit className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(tariff.id)}
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
