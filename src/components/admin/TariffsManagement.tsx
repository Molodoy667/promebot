import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Trash2, Plus, Check, X, Save, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { TariffMobileCard } from "./TariffMobileCard";
import { Card } from "@/components/ui/card";

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
  is_trial?: boolean;
  bots_limit?: number;
  duration_days?: number | null;
  allow_media?: boolean;
  allow_new_posts_only?: boolean;
  allow_keyword_filter?: boolean;
  allow_scheduled_posting?: boolean;
  allow_post_as_channel?: boolean;
  allow_auto_delete?: boolean;
  allow_custom_watermark?: boolean;
  allow_link_preview?: boolean;
  allow_forward_tag?: boolean;
  allow_edit_before_post?: boolean;
}

interface TariffsManagementProps {
  tariffs: Tariff[];
  onRefresh: () => void;
  mode?: "list" | "create" | "edit";
  editingTariff?: Tariff | null;
  onEdit?: (tariff: Tariff) => void;
  onCreateNew?: () => void;
  onSuccess?: () => void;
}

export const TariffsManagement = ({ 
  tariffs, 
  onRefresh, 
  mode = "list",
  editingTariff,
  onEdit,
  onCreateNew,
  onSuccess 
}: TariffsManagementProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    channels_limit: "",
    sources_limit: "",
    posts_per_month: "",
    bots_limit: "",
    duration_days: "",
    is_active: true,
    is_trial: false,
    allow_media: true,
    allow_new_posts_only: true,
    allow_keyword_filter: true,
    allow_scheduled_posting: false,
    allow_post_as_channel: true,
    allow_auto_delete: false,
    allow_custom_watermark: false,
    allow_link_preview: true,
    allow_forward_tag: false,
    allow_edit_before_post: false,
  });

  // Real-time updates for tariffs
  useEffect(() => {
    const tariffsChannel = supabase
      .channel('tariffs_management_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tariffs',
        },
        () => {
          console.log('Tariff changed in admin, refreshing...');
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      tariffsChannel.unsubscribe();
    };
  }, [onRefresh]);

  // Load editing tariff data
  useEffect(() => {
    if (mode === "edit" && editingTariff) {
      setFormData({
        name: editingTariff.name,
        description: editingTariff.description || "",
        price: editingTariff.price.toString(),
        channels_limit: editingTariff.channels_limit.toString(),
        sources_limit: editingTariff.sources_limit?.toString() || "5",
        posts_per_month: editingTariff.posts_per_month.toString(),
        bots_limit: editingTariff.bots_limit?.toString() || "1",
        duration_days: editingTariff.duration_days?.toString() || "",
        is_active: editingTariff.is_active,
        is_trial: editingTariff.is_trial ?? false,
        allow_media: editingTariff.allow_media ?? true,
        allow_new_posts_only: editingTariff.allow_new_posts_only ?? true,
        allow_keyword_filter: editingTariff.allow_keyword_filter ?? true,
        allow_scheduled_posting: editingTariff.allow_scheduled_posting ?? false,
        allow_post_as_channel: editingTariff.allow_post_as_channel ?? true,
        allow_auto_delete: editingTariff.allow_auto_delete ?? false,
        allow_custom_watermark: editingTariff.allow_custom_watermark ?? false,
        allow_link_preview: editingTariff.allow_link_preview ?? true,
        allow_forward_tag: editingTariff.allow_forward_tag ?? false,
        allow_edit_before_post: editingTariff.allow_edit_before_post ?? false,
      });
    }
  }, [mode, editingTariff]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      channels_limit: "",
      sources_limit: "",
      posts_per_month: "",
      bots_limit: "",
      duration_days: "",
      is_active: true,
      is_trial: false,
      allow_media: true,
      allow_new_posts_only: true,
      allow_keyword_filter: true,
      allow_scheduled_posting: false,
      allow_post_as_channel: true,
      allow_auto_delete: false,
      allow_custom_watermark: false,
      allow_link_preview: true,
      allow_forward_tag: false,
      allow_edit_before_post: false,
    });
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase.from("tariffs").insert({
        name: formData.name,
        name_en: formData.name,
        description: formData.description,
        description_en: formData.description,
        price: parseFloat(formData.price) || 0,
        channels_limit: parseInt(formData.channels_limit) || 0,
        sources_limit: parseInt(formData.sources_limit) || 5,
        posts_per_month: parseInt(formData.posts_per_month) || 0,
        bots_limit: parseInt(formData.bots_limit) || 1,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
        is_active: formData.is_active,
        is_trial: formData.is_trial,
        allow_media: formData.allow_media,
        allow_new_posts_only: formData.allow_new_posts_only,
        allow_keyword_filter: formData.allow_keyword_filter,
        allow_scheduled_posting: formData.allow_scheduled_posting,
        allow_post_as_channel: formData.allow_post_as_channel,
        allow_auto_delete: formData.allow_auto_delete,
        allow_custom_watermark: formData.allow_custom_watermark,
        allow_link_preview: formData.allow_link_preview,
        allow_forward_tag: formData.allow_forward_tag,
        allow_edit_before_post: formData.allow_edit_before_post,
      });

      if (error) throw error;

      toast({
        title: "Тариф створено",
        description: "Новий тариф успішно додано",
        duration: 1500,
      });

      resetForm();
      onRefresh();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleEdit = async () => {
    if (!editingTariff) return;

    try {
      const { error } = await supabase
        .from("tariffs")
        .update({
          name: formData.name,
          name_en: formData.name,
          description: formData.description,
          description_en: formData.description,
          price: parseFloat(formData.price) || 0,
          channels_limit: parseInt(formData.channels_limit) || 0,
          sources_limit: parseInt(formData.sources_limit) || 5,
          posts_per_month: parseInt(formData.posts_per_month) || 0,
          bots_limit: parseInt(formData.bots_limit) || 1,
          duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
          is_active: formData.is_active,
          is_trial: formData.is_trial,
          allow_media: formData.allow_media,
          allow_new_posts_only: formData.allow_new_posts_only,
          allow_keyword_filter: formData.allow_keyword_filter,
          allow_scheduled_posting: formData.allow_scheduled_posting,
          allow_post_as_channel: formData.allow_post_as_channel,
          allow_auto_delete: formData.allow_auto_delete,
          allow_custom_watermark: formData.allow_custom_watermark,
          allow_link_preview: formData.allow_link_preview,
          allow_forward_tag: formData.allow_forward_tag,
          allow_edit_before_post: formData.allow_edit_before_post,
        })
        .eq("id", editingTariff.id);

      if (error) throw error;

      toast({
        title: "Тариф оновлено",
        description: "Зміни успішно збережено",
        duration: 1500,
      });

      onRefresh();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleToggleActive = async (tariffId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("tariffs")
        .update({ is_active: !currentStatus })
        .eq("id", tariffId);

      if (error) throw error;

      toast({
        title: "Статус оновлено",
        description: `Тариф ${!currentStatus ? "активовано" : "деактивовано"}`,
        duration: 1500,
      });

      onRefresh();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleDelete = async (tariffId: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цей тариф?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tariffs")
        .delete()
        .eq("id", tariffId);

      if (error) throw error;

      toast({
        title: "Тариф видалено",
        description: "Тариф успішно видалено",
        duration: 1500,
      });

      onRefresh();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (mode === "create" || mode === "edit") {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Назва тарифу</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Базовий"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Опис</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Для початківців"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Ціна (₴)</Label>
              <Input
                id="price"
                type="text"
                inputMode="decimal"
                placeholder="99"
                value={formData.price}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}(\.\d{0,2})?$/.test(value)) {
                    handleInputChange("price", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_days">Тривалість (днів)</Label>
              <Input
                id="duration_days"
                type="text"
                inputMode="numeric"
                placeholder="30 (порожнє = безліміт)"
                value={formData.duration_days}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}$/.test(value)) {
                    handleInputChange("duration_days", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bots_limit">Боти</Label>
              <Input
                id="bots_limit"
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={formData.bots_limit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}$/.test(value)) {
                    handleInputChange("bots_limit", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="channels">Канали</Label>
              <Input
                id="channels"
                type="text"
                inputMode="numeric"
                placeholder="5"
                value={formData.channels_limit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}$/.test(value)) {
                    handleInputChange("channels_limit", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sources">Джерела</Label>
              <Input
                id="sources"
                type="text"
                inputMode="numeric"
                placeholder="5"
                value={formData.sources_limit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}$/.test(value)) {
                    handleInputChange("sources_limit", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posts">Пости/місяць</Label>
              <Input
                id="posts"
                type="text"
                inputMode="numeric"
                placeholder="3000"
                value={formData.posts_per_month}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d{0,10}$/.test(value)) {
                    handleInputChange("posts_per_month", value);
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-base">Дозволені функції</h3>
            <p className="text-sm text-muted-foreground">Виберіть які функції будуть доступні для цього тарифу</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_media" className="cursor-pointer font-medium">Копіювання медіа</Label>
                  <p className="text-xs text-muted-foreground">Зображення та відео</p>
                </div>
                <Switch
                  id="allow_media"
                  checked={formData.allow_media}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_media: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_new_posts" className="cursor-pointer font-medium">Тільки нові пости</Label>
                  <p className="text-xs text-muted-foreground">Вибір нових постів</p>
                </div>
                <Switch
                  id="allow_new_posts"
                  checked={formData.allow_new_posts_only}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_new_posts_only: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_keyword" className="cursor-pointer font-medium">Фільтр ключових слів</Label>
                  <p className="text-xs text-muted-foreground">Пошук по словам</p>
                </div>
                <Switch
                  id="allow_keyword"
                  checked={formData.allow_keyword_filter}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_keyword_filter: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_scheduled" className="cursor-pointer font-medium">Відкладена публікація</Label>
                  <p className="text-xs text-muted-foreground">Інтервал між постами</p>
                </div>
                <Switch
                  id="allow_scheduled"
                  checked={formData.allow_scheduled_posting}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_scheduled_posting: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_as_channel" className="cursor-pointer font-medium">Публікація від каналу</Label>
                  <p className="text-xs text-muted-foreground">Без підпису бота</p>
                </div>
                <Switch
                  id="allow_as_channel"
                  checked={formData.allow_post_as_channel}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_post_as_channel: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_auto_delete" className="cursor-pointer font-medium">Авто-видалення</Label>
                  <p className="text-xs text-muted-foreground">Видалення через час</p>
                </div>
                <Switch
                  id="allow_auto_delete"
                  checked={formData.allow_auto_delete}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_auto_delete: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_watermark" className="cursor-pointer font-medium">Водяний знак</Label>
                  <p className="text-xs text-muted-foreground">Додавання логотипу</p>
                </div>
                <Switch
                  id="allow_watermark"
                  checked={formData.allow_custom_watermark}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_custom_watermark: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_preview" className="cursor-pointer font-medium">Попередній перегляд</Label>
                  <p className="text-xs text-muted-foreground">Превью посилань</p>
                </div>
                <Switch
                  id="allow_preview"
                  checked={formData.allow_link_preview}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_link_preview: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_forward" className="cursor-pointer font-medium">Мітка пересилання</Label>
                  <p className="text-xs text-muted-foreground">Збереження форварду</p>
                </div>
                <Switch
                  id="allow_forward"
                  checked={formData.allow_forward_tag}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_forward_tag: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="allow_edit" className="cursor-pointer font-medium">Редагування</Label>
                  <p className="text-xs text-muted-foreground">Перед публікацією</p>
                </div>
                <Switch
                  id="allow_edit"
                  checked={formData.allow_edit_before_post}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allow_edit_before_post: checked })
                  }
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-base">Налаштування тарифу</h3>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="is_trial" className="cursor-pointer font-medium">Пробний тариф</Label>
                <p className="text-xs text-muted-foreground">Користувач може купити лише 1 раз</p>
              </div>
              <Switch
                id="is_trial"
                checked={formData.is_trial}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_trial: checked })
                }
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="active">Активний</Label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              onSuccess?.();
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Скасувати
          </Button>
          <Button onClick={mode === "create" ? handleCreate : handleEdit}>
            <Save className="w-4 h-4 mr-2" />
            {mode === "create" ? "Створити" : "Зберегти"}
          </Button>
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-sm">
          Всього тарифів: {tariffs.length}
        </Badge>
        <Button
          onClick={onCreateNew}
          className="bg-gradient-primary hover:opacity-90 transition-smooth"
        >
          <Plus className="w-4 h-4 mr-2" />
          Додати тариф
        </Button>
      </div>

      {/* Desktop - Table View */}
      {!isMobile && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Назва</TableHead>
                  <TableHead className="font-semibold">Ціна</TableHead>
                  <TableHead className="font-semibold">Ліміти</TableHead>
                  <TableHead className="font-semibold">Функції</TableHead>
                  <TableHead className="font-semibold">Статус</TableHead>
                  <TableHead className="font-semibold text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Тарифів не знайдено
                    </TableCell>
                  </TableRow>
                ) : (
                  tariffs.map((tariff) => (
                    <TableRow key={tariff.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{tariff.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {tariff.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {tariff.price} ₴
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Канали:</span>
                            <span className="font-semibold">{tariff.channels_limit}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Боти:</span>
                            <span className="font-semibold">{tariff.bots_limit || 1}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Пости:</span>
                            <span className="font-semibold">{tariff.posts_per_month}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {tariff.allow_media && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              Медіа
                            </Badge>
                          )}
                          {tariff.allow_scheduled_posting && (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              Відкладені
                            </Badge>
                          )}
                          {tariff.allow_keyword_filter && (
                            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              Ключові слова
                            </Badge>
                          )}
                          {tariff.allow_post_as_channel && (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              Від імені каналу
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tariff.is_active}
                            onCheckedChange={() =>
                              handleToggleActive(tariff.id, tariff.is_active)
                            }
                          />
                          {tariff.is_active ? (
                            <Badge className="bg-success/20 text-success border-success/30">
                              <Check className="w-3 h-3 mr-1" />
                              Активний
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <X className="w-3 h-3 mr-1" />
                              Неактивний
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit?.(tariff)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Редагувати
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Mobile - Card View */}
      {isMobile && (
        <div className="space-y-3">
          {tariffs.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              Тарифів не знайдено
            </Card>
          ) : (
            tariffs.map((tariff) => (
              <TariffMobileCard
                key={tariff.id}
                tariff={tariff}
                onEdit={onEdit!}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
