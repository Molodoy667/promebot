import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Star, Sparkles, Lock, Check, Flag, Zap, Rocket, Coins, Bot, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  achievement_key: string;
  name: string;
  description: string;
  icon: string;
  category: 'beginner' | 'active' | 'pro';
  requirement: number;
  reward_coins: number;
}

interface UserAchievement {
  achievement_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

interface AchievementsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const Achievements = ({ open, onOpenChange }: AchievementsProps) => {
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<Map<string, UserAchievement>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'beginner' | 'active' | 'pro'>('beginner');

  useEffect(() => {
    if (open) {
      loadAchievements();
    }
  }, [open]);

  const loadAchievements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load all achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from("miner_achievements")
        .select("*")
        .order("category", { ascending: true })
        .order("requirement", { ascending: true });

      if (achievementsError) throw achievementsError;

      // Load user's achievement progress
      const { data: userAchievementsData, error: userError } = await supabase
        .from("miner_user_achievements")
        .select("*")
        .eq("user_id", user.id);

      if (userError) throw userError;

      // Cast category to the expected type
      const typedAchievements = (achievementsData || []).map(a => ({
        ...a,
        category: a.category as 'beginner' | 'active' | 'pro'
      }));
      setAchievements(typedAchievements);

      const userAchMap = new Map<string, UserAchievement>();
      userAchievementsData?.forEach(ua => {
        userAchMap.set(ua.achievement_id, ua);
      });
      setUserAchievements(userAchMap);

    } catch (error) {
      console.error("Error loading achievements:", error);
      toast({
        title: "Помилка",
        description: "Помилка завантаження досягнень",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'beginner':
        return <Star className="w-5 h-5 text-blue-500" />;
      case 'active':
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 'pro':
        return <Sparkles className="w-5 h-5 text-purple-500" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'beginner':
        return 'from-blue-500/10 to-cyan-500/10 border-blue-500/30';
      case 'active':
        return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/30';
      case 'pro':
        return 'from-purple-500/10 to-pink-500/10 border-purple-500/30';
      default:
        return 'from-slate-500/10 to-slate-500/10 border-slate-500/30';
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'beginner':
        return 'Початківець';
      case 'active':
        return 'Активний';
      case 'pro':
        return 'Професіонал';
      default:
        return category;
    }
  };

  const filteredAchievements = achievements.filter(a => a.category === selectedCategory);
  const completedCount = filteredAchievements.filter(a => 
    userAchievements.get(a.id)?.completed
  ).length;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Trophy className="w-7 h-7 text-yellow-500" />
            Досягнення
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={(v: any) => setSelectedCategory(v)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="beginner">
              <Flag className="w-4 h-4 mr-1.5" />
              {getCategoryTitle('beginner')}
              <Badge variant="secondary" className="ml-2">{achievements.filter(a => a.category === 'beginner').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="active">
              <Zap className="w-4 h-4 mr-1.5" />
              {getCategoryTitle('active')}
              <Badge variant="secondary" className="ml-2">{achievements.filter(a => a.category === 'active').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pro">
              <Rocket className="w-4 h-4 mr-1.5" />
              {getCategoryTitle('pro')}
              <Badge variant="secondary" className="ml-2">{achievements.filter(a => a.category === 'pro').length}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 mb-6">
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Прогрес</p>
                  <p className="text-xl font-bold">
                    {completedCount} / {filteredAchievements.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Виконано</p>
                  <p className="text-xl font-bold text-primary">
                    {Math.round((completedCount / filteredAchievements.length) * 100)}%
                  </p>
                </div>
              </div>
              <Progress 
                value={(completedCount / filteredAchievements.length) * 100} 
                className="mt-3"
              />
            </Card>
          </div>

          {['beginner', 'active', 'pro'].map((category) => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements
                  .filter(a => a.category === category)
                  .map((achievement) => {
                    const userAch = userAchievements.get(achievement.id);
                    const progress = userAch?.progress || 0;
                    const completed = userAch?.completed || false;
                    const progressPercent = Math.min((progress / achievement.requirement) * 100, 100);

                    return (
                      <Card
                        key={achievement.id}
                        className={cn(
                          "p-5 transition-all bg-gradient-to-br",
                          getCategoryColor(achievement.category),
                          completed && "ring-2 ring-primary shadow-glow"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="text-5xl flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-xl border-2 border-primary/30">
                            {achievement.icon === '🎯' && <Trophy className="w-8 h-8 text-yellow-500" />}
                            {achievement.icon === '🤖' && <Bot className="w-8 h-8 text-blue-500" />}
                            {achievement.icon === '⚡' && <Zap className="w-8 h-8 text-cyan-500" />}
                            {achievement.icon === '💎' && <Gem className="w-8 h-8 text-purple-500" />}
                            {achievement.icon === '🏆' && <Trophy className="w-8 h-8 text-yellow-500" />}
                            {achievement.icon === '🚀' && <Rocket className="w-8 h-8 text-orange-500" />}
                            {achievement.icon === '⭐' && <Star className="w-8 h-8 text-yellow-400" />}
                            {achievement.icon === '💰' && <Coins className="w-8 h-8 text-green-500" />}
                            {achievement.icon === '✨' && <Sparkles className="w-8 h-8 text-pink-500" />}
                            {!['🎯', '🤖', '⚡', '💎', '🏆', '🚀', '⭐', '💰', '✨'].includes(achievement.icon) && <Trophy className="w-8 h-8 text-primary" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-bold text-lg">{achievement.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {achievement.description}
                                </p>
                              </div>
                              {completed && (
                                <Check className="w-6 h-6 text-green-500 flex-shrink-0" />
                              )}
                            </div>

                            {/* Progress */}
                            {!completed && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">Прогрес</span>
                                  <span className="font-semibold">
                                    {progress} / {achievement.requirement}
                                  </span>
                                </div>
                                <Progress value={progressPercent} className="h-2" />
                              </div>
                            )}

                            {/* Reward */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                              <Badge variant={completed ? "default" : "secondary"}>
                                {completed ? "Виконано" : "В процесі"}
                              </Badge>
                              <div className="flex items-center gap-1 text-yellow-500 font-bold">
                                <Coins className="w-4 h-4" />
                                <span>+{achievement.reward_coins}</span>
                              </div>
                            </div>

                            {/* Completed date */}
                            {completed && userAch?.completed_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Виконано: {new Date(userAch.completed_at).toLocaleDateString('uk-UA')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Info */}
        <Card className="p-4 bg-muted/30 mt-4">
          <p className="text-sm text-muted-foreground text-center">
            Виконуйте досягнення щоб отримувати монети!
            <br />
            Прогрес оновлюється автоматично
          </p>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

