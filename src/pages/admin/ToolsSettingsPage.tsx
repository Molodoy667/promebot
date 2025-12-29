import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings, MessageSquare, ImageIcon, FileText } from "lucide-react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

interface Tool {
  id: string;
  tool_key: string;
  tool_name: string;
  tool_description: string;
  is_enabled: boolean;
  display_order: number;
  price: number;
  vip_discount_enabled: boolean;
  vip_discount_percent: number;
  rental_duration_minutes?: number;
  free_duration_minutes?: number;
  free_cooldown_hours?: number;
}

const toolIcons = {
  image_generation: ImageIcon,
  post_generation: FileText,
  ai_chat: MessageSquare,
};

export default function ToolsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tools_settings")
        .select("*")
        .order("display_order");

      if (error) throw error;

      setTools(data || []);
    } catch (error) {
      console.error("Error loading tools:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування інструментів",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTool = (toolKey: string, field: keyof Tool, value: any) => {
    setTools(tools.map(t => 
      t.tool_key === toolKey ? { ...t, [field]: value } : t
    ));
  };

  const saveTool = async (toolKey: string) => {
    setSaving(toolKey);
    try {
      const tool = tools.find(t => t.tool_key === toolKey);
      if (!tool) return;

      const { error } = await supabase
        .from("tools_settings")
        .update({
          tool_name: tool.tool_name,
          tool_description: tool.tool_description,
          is_enabled: tool.is_enabled,
          display_order: tool.display_order,
          price: tool.price,
          vip_discount_enabled: tool.vip_discount_enabled,
          vip_discount_percent: tool.vip_discount_percent,
          rental_duration_minutes: tool.rental_duration_minutes,
          free_duration_minutes: tool.free_duration_minutes,
          free_cooldown_hours: tool.free_cooldown_hours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tool.id);

      if (error) throw error;

      toast({
        title: "Збережено",
        description: `Налаштування інструменту "${tool.tool_name}" оновлено`,
      });
    } catch (error) {
      console.error("Error saving tool:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти зміни",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs />
      
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Налаштування інструментів</h1>
          </div>
        </div>
        <p className="text-muted-foreground ml-13">
          Редагуйте назви, описи та доступність інструментів
        </p>
      </div>

      <div className="grid gap-6">
        {tools.map((tool) => {
          const Icon = toolIcons[tool.tool_key as keyof typeof toolIcons] || Settings;
          
          return (
            <Card key={tool.id} className="glass-effect border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>{tool.tool_name}</CardTitle>
                    <CardDescription className="text-xs">
                      Ключ: {tool.tool_key}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={tool.is_enabled}
                    onCheckedChange={(checked) => updateTool(tool.tool_key, "is_enabled", checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`name_${tool.tool_key}`}>Назва інструменту</Label>
                  <Input
                    id={`name_${tool.tool_key}`}
                    type="text"
                    value={tool.tool_name}
                    onChange={(e) => updateTool(tool.tool_key, "tool_name", e.target.value)}
                    placeholder="Назва"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`desc_${tool.tool_key}`}>Опис інструменту</Label>
                  <Textarea
                    id={`desc_${tool.tool_key}`}
                    value={tool.tool_description}
                    onChange={(e) => updateTool(tool.tool_key, "tool_description", e.target.value)}
                    placeholder="Опис"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`order_${tool.tool_key}`}>Порядок відображення</Label>
                  <Input
                    id={`order_${tool.tool_key}`}
                    type="text"
                    value={tool.display_order}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || !isNaN(parseInt(value))) {
                        updateTool(tool.tool_key, "display_order", parseInt(value) || 0);
                      }
                    }}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Менше число = вище в списку
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`price_${tool.tool_key}`}>Ціна (бонусні ₴)</Label>
                  <Input
                    id={`price_${tool.tool_key}`}
                    type="text"
                    value={tool.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || !isNaN(parseFloat(value))) {
                        updateTool(tool.tool_key, "price", parseFloat(value) || 0);
                      }
                    }}
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Вартість використання інструменту
                  </p>
                </div>

                <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>VIP знижка</Label>
                      <p className="text-xs text-muted-foreground">
                        Увімкнути знижку для VIP користувачів
                      </p>
                    </div>
                    <Switch
                      checked={tool.vip_discount_enabled}
                      onCheckedChange={(checked) => updateTool(tool.tool_key, "vip_discount_enabled", checked)}
                    />
                  </div>

                  {tool.vip_discount_enabled && (
                    <div className="space-y-2">
                      <Label htmlFor={`discount_${tool.tool_key}`}>Відсоток знижки (%)</Label>
                      <Input
                        id={`discount_${tool.tool_key}`}
                        type="text"
                        value={tool.vip_discount_percent}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || !isNaN(parseInt(value))) {
                            const percent = parseInt(value) || 0;
                            if (percent >= 0 && percent <= 100) {
                              updateTool(tool.tool_key, "vip_discount_percent", percent);
                            }
                          }
                        }}
                        placeholder="50"
                      />
                      <p className="text-xs text-muted-foreground">
                        VIP ціна: {(tool.price * (1 - tool.vip_discount_percent / 100)).toFixed(2)} ₴
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Chat specific settings */}
                {tool.tool_key === 'ai_chat' && (
                  <div className="space-y-4 p-4 rounded-lg bg-primary/5 border">
                    <h4 className="font-semibold text-sm">Налаштування AI Чату</h4>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`rental_duration_${tool.tool_key}`}>
                          Тривалість оренди (хвилини)
                        </Label>
                        <Input
                          id={`rental_duration_${tool.tool_key}`}
                          type="text"
                          value={tool.rental_duration_minutes ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(parseInt(value))) {
                              updateTool(tool.tool_key, "rental_duration_minutes", value === '' ? null : parseInt(value));
                            }
                          }}
                          placeholder="60"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`free_duration_${tool.tool_key}`}>
                          Безкоштовна тривалість (хвилини)
                        </Label>
                        <Input
                          id={`free_duration_${tool.tool_key}`}
                          type="text"
                          value={tool.free_duration_minutes ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(parseInt(value))) {
                              updateTool(tool.tool_key, "free_duration_minutes", value === '' ? null : parseInt(value));
                            }
                          }}
                          placeholder="10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cooldown_${tool.tool_key}`}>
                          Кулдаун (години)
                        </Label>
                        <Input
                          id={`cooldown_${tool.tool_key}`}
                          type="text"
                          value={tool.free_cooldown_hours ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(parseInt(value))) {
                              updateTool(tool.tool_key, "free_cooldown_hours", value === '' ? null : parseInt(value));
                            }
                          }}
                          placeholder="6"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveTool(tool.tool_key)}
                    disabled={saving === tool.tool_key}
                  >
                    {saving === tool.tool_key && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Зберегти зміни
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
