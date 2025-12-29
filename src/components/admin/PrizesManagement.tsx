import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { Gift } from "lucide-react";

type AudienceType = 'all' | 'new' | 'admins' | 'moderators';

export const PrizesManagement = () => {
  const { toast } = useToast();
  const [spinsCount, setSpinsCount] = useState<number>(1);
  const [audience, setAudience] = useState<AudienceType>('all');
  const [isLoading, setIsLoading] = useState(false);

  const handleDistributeSpins = async () => {
    if (spinsCount < 1) {
      toast({
        title: "Помилка",
        description: "Кількість обертів повинна бути більше 0",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let userIds: string[] = [];

      // Get user IDs based on audience selection
      if (audience === 'all') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id');
        userIds = profiles?.map(p => p.id) || [];
      } else if (audience === 'new') {
        // Users registered in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .gte('created_at', sevenDaysAgo.toISOString());
        userIds = profiles?.map(p => p.id) || [];
      } else if (audience === 'admins' || audience === 'moderators') {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', audience === 'admins' ? 'admin' : 'moderator');
        userIds = userRoles?.map(ur => ur.user_id) || [];
      }

      if (userIds.length === 0) {
        toast({
          title: "Увага",
          description: "Не знайдено користувачів для роздачі",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Update or insert free spins for each user
      for (const userId of userIds) {
        const { data: existing } = await supabase
          .from('free_spins')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (existing) {
          await supabase
            .from('free_spins')
            .update({ 
              spins_count: existing.spins_count + spinsCount,
              notification_shown: false,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('free_spins')
            .insert({ 
              user_id: userId, 
              spins_count: spinsCount,
              notification_shown: false
            });
        }
      }

      toast({
        title: "Успішно",
        description: `Роздано ${spinsCount} обертів для ${userIds.length} користувачів`,
      });

      setSpinsCount(1);
    } catch (error: any) {
      console.error('Error distributing spins:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося роздати оберти",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 glass-effect border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <Gift className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Роздача безкоштовних обертів</h2>
          <p className="text-sm text-muted-foreground">
            Видайте безкоштовні оберти рулетки користувачам
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="spins-count">Кількість обертів</Label>
          <Input
            id="spins-count"
            type="text"
            value={spinsCount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || !isNaN(parseInt(value))) {
                setSpinsCount(parseInt(value) || 1);
              }
            }}
            className="max-w-xs"
            placeholder="1"
          />
        </div>

        <div className="space-y-3">
          <Label>Аудиторія</Label>
          <RadioGroup value={audience} onValueChange={(value) => setAudience(value as AudienceType)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="font-normal cursor-pointer">
                Видати усім користувачам
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="font-normal cursor-pointer">
                Видати лише новим користувачам (за останні 7 днів)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="admins" id="admins" />
              <Label htmlFor="admins" className="font-normal cursor-pointer">
                Видати лише Адмінам
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="moderators" id="moderators" />
              <Label htmlFor="moderators" className="font-normal cursor-pointer">
                Видати лише Модераторам
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={handleDistributeSpins}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? "Роздача..." : "Роздати оберти"}
        </Button>
      </div>
    </Card>
  );
};
