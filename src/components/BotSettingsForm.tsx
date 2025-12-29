import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { ChannelInfo } from "@/components/ChannelInfo";

interface BotService {
  id: string;
  posts_per_month: number;
  post_interval_minutes: number;
  include_media: boolean;
  post_as_bot: boolean;
  publish_immediately: boolean;
  publish_old_posts: boolean;
  allow_auto_delete?: boolean;
  allow_custom_watermark?: boolean;
  allow_link_preview?: boolean;
  allow_forward_tag?: boolean;
  allow_edit_before_post?: boolean;
}

interface Tariff {
  posts_per_month: number;
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

interface BotSettingsFormProps {
  botService: BotService;
  tariff: Tariff | null;
  targetChannel: string;
  botToken: string;
  keywords: string;
  useKeywordFilter: boolean;
  onKeywordsChange: (keywords: string) => void;
  onUseKeywordFilterChange: (enabled: boolean) => void;
  onFieldUpdate: (field: string, value: any) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const BotSettingsForm = ({
  botService,
  tariff,
  targetChannel,
  botToken,
  keywords,
  useKeywordFilter,
  onKeywordsChange,
  onUseKeywordFilterChange,
  onFieldUpdate,
  onSave,
  isSaving
}: BotSettingsFormProps) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Основні налаштування</h2>
      <div className="space-y-6">
        {/* Channel Info */}
        <div className="space-y-2">
          <Label>Цільовий канал</Label>
          {targetChannel && botToken && (
            <ChannelInfo 
              channelUsername={targetChannel} 
              botToken={botToken}
            />
          )}
        </div>

        <Separator />

        {/* Filters Section */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="text-lg font-semibold">Налаштування фільтрів</span>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Доступність фільтрів залежить від вашого тарифу
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Копіювання медіа */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_media ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="include_media" className="cursor-pointer font-medium">
                    Копіювання медіа
                  </Label>
                  <p className="text-xs text-muted-foreground">Зображення та відео</p>
                  {!tariff?.allow_media && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="include_media"
                  checked={botService?.include_media ?? true}
                  onCheckedChange={(checked) => onFieldUpdate('include_media', checked)}
                  disabled={!tariff?.allow_media}
                />
              </div>

              {/* Тільки нові пости */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_new_posts_only ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="publish_old_posts" className="cursor-pointer font-medium">
                    Тільки нові пости
                  </Label>
                  <p className="text-xs text-muted-foreground">Без старих постів</p>
                  {!tariff?.allow_new_posts_only && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="publish_old_posts"
                  checked={!(botService?.publish_old_posts ?? false)}
                  onCheckedChange={(checked) => onFieldUpdate('publish_old_posts', !checked)}
                  disabled={!tariff?.allow_new_posts_only}
                />
              </div>

              {/* Фільтр ключових слів */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_keyword_filter ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="use_keyword_filter" className="cursor-pointer font-medium">
                    Фільтр ключових слів
                  </Label>
                  <p className="text-xs text-muted-foreground">Пошук по словам</p>
                  {!tariff?.allow_keyword_filter && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="use_keyword_filter"
                  checked={useKeywordFilter}
                  onCheckedChange={onUseKeywordFilterChange}
                  disabled={!tariff?.allow_keyword_filter}
                />
              </div>

              {/* Відкладена публікація */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_scheduled_posting ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="publish_immediately" className="cursor-pointer font-medium">
                    Відкладена публікація
                  </Label>
                  <p className="text-xs text-muted-foreground">Інтервал між постами</p>
                  {!tariff?.allow_scheduled_posting && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="publish_immediately"
                  checked={!(botService?.publish_immediately ?? false)}
                  onCheckedChange={(checked) => onFieldUpdate('publish_immediately', !checked)}
                  disabled={!tariff?.allow_scheduled_posting}
                />
              </div>

              {/* Публікація від каналу */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_post_as_channel ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="post_as_bot" className="cursor-pointer font-medium">
                    Публікація від каналу
                  </Label>
                  <p className="text-xs text-muted-foreground">Без підпису бота</p>
                  {!tariff?.allow_post_as_channel && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="post_as_bot"
                  checked={!(botService?.post_as_bot ?? true)}
                  onCheckedChange={(checked) => onFieldUpdate('post_as_bot', !checked)}
                  disabled={!tariff?.allow_post_as_channel}
                />
              </div>

              {/* Авто-видалення */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_auto_delete ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="allow_auto_delete" className="cursor-pointer font-medium">
                    Авто-видалення
                  </Label>
                  <p className="text-xs text-muted-foreground">Видалення через час</p>
                  {!tariff?.allow_auto_delete && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="allow_auto_delete"
                  checked={botService?.allow_auto_delete ?? false}
                  onCheckedChange={(checked) => onFieldUpdate('allow_auto_delete', checked)}
                  disabled={!tariff?.allow_auto_delete}
                />
              </div>

              {/* Водяний знак */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_custom_watermark ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="allow_custom_watermark" className="cursor-pointer font-medium">
                    Водяний знак
                  </Label>
                  <p className="text-xs text-muted-foreground">Додавання логотипу</p>
                  {!tariff?.allow_custom_watermark && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="allow_custom_watermark"
                  checked={botService?.allow_custom_watermark ?? false}
                  onCheckedChange={(checked) => onFieldUpdate('allow_custom_watermark', checked)}
                  disabled={!tariff?.allow_custom_watermark}
                />
              </div>

              {/* Попередній перегляд */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_link_preview ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="allow_link_preview" className="cursor-pointer font-medium">
                    Попередній перегляд
                  </Label>
                  <p className="text-xs text-muted-foreground">Превью посилань</p>
                  {!tariff?.allow_link_preview && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="allow_link_preview"
                  checked={botService?.allow_link_preview ?? true}
                  onCheckedChange={(checked) => onFieldUpdate('allow_link_preview', checked)}
                  disabled={!tariff?.allow_link_preview}
                />
              </div>

              {/* Мітка пересилання */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_forward_tag ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="allow_forward_tag" className="cursor-pointer font-medium">
                    Мітка пересилання
                  </Label>
                  <p className="text-xs text-muted-foreground">Збереження форварду</p>
                  {!tariff?.allow_forward_tag && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="allow_forward_tag"
                  checked={botService?.allow_forward_tag ?? false}
                  onCheckedChange={(checked) => onFieldUpdate('allow_forward_tag', checked)}
                  disabled={!tariff?.allow_forward_tag}
                />
              </div>

              {/* Редагування постів */}
              <div className={`flex items-center justify-between p-4 border rounded-lg ${
                tariff?.allow_edit_before_post ? '' : 'opacity-50 bg-muted/50'
              }`}>
                <div className="flex-1">
                  <Label htmlFor="allow_edit_before_post" className="cursor-pointer font-medium">
                    Редагування постів
                  </Label>
                  <p className="text-xs text-muted-foreground">Перед публікацією</p>
                  {!tariff?.allow_edit_before_post && (
                    <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                  )}
                </div>
                <Switch
                  id="allow_edit_before_post"
                  checked={botService?.allow_edit_before_post ?? false}
                  onCheckedChange={(checked) => onFieldUpdate('allow_edit_before_post', checked)}
                  disabled={!tariff?.allow_edit_before_post}
                />
              </div>
            </div>

            {/* Keyword Filter Input */}
            {useKeywordFilter && tariff?.allow_keyword_filter && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label htmlFor="keywords">Ключові слова (через кому)</Label>
                <Textarea
                  id="keywords"
                  value={keywords}
                  onChange={(e) => onKeywordsChange(e.target.value)}
                  placeholder="слово1, слово2, слово3"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Бот буде копіювати тільки пости, що містять хоча б одне із цих слів
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Posts & Intervals Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="posts_per_month">
              Постів на місяць (макс: {tariff?.posts_per_month || 300})
            </Label>
            <Input
              id="posts_per_month"
              type="text"
              value={botService?.posts_per_month || 300}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || !isNaN(parseInt(value))) {
                  const numValue = parseInt(value) || 0;
                  if (numValue >= 1 && numValue <= (tariff?.posts_per_month || 300)) {
                    onFieldUpdate('posts_per_month', numValue);
                  }
                }
              }}
              placeholder="10"
            />
          </div>

          {botService?.publish_old_posts !== false && (
            <div className="space-y-2">
              <Label htmlFor="post_interval">
                Інтервал між постами (хвилин)
              </Label>
              <Input
                id="post_interval"
                type="text"
                value={botService?.post_interval_minutes || 60}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || !isNaN(parseInt(value))) {
                    const numValue = parseInt(value) || 60;
                    if (numValue >= 1) {
                      onFieldUpdate('post_interval_minutes', numValue);
                    }
                  }
                }}
                placeholder="60"
              />
            </div>
          )}
        </div>

        <Button 
          onClick={onSave} 
          disabled={isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <>
              <Save className="w-4 h-4 mr-2 animate-pulse" />
              Збереження...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Зберегти налаштування
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

