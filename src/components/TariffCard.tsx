import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface TariffFeature {
  key: string;
  label: string;
  enabled: boolean;
}

interface Tariff {
  id: string;
  name: string;
  description: string;
  price: number;
  channels_limit: number;
  bots_limit: number;
  posts_per_month: number;
  sources_limit: number;
  duration_days: number | null;
  features_list: TariffFeature[];
  is_trial: boolean;
  allow_ai_images?: boolean;
}

interface TariffCardProps {
  tariff: Tariff;
  isCurrentTariff?: boolean;
  onSelect: (tariff: Tariff) => void;
}

export const TariffCard = ({ tariff, isCurrentTariff = false, onSelect }: TariffCardProps) => {
  // Guard against undefined tariff
  if (!tariff) {
    console.error('TariffCard received undefined tariff');
    return null;
  }

  const isPremium = tariff.price > 500;
  const [isExpanded, setIsExpanded] = useState(false);
  const enabledCount = tariff.features_list?.filter(f => f.enabled).length || 0;
  const disabledCount = tariff.features_list?.filter(f => !f.enabled).length || 0;
  
  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-2xl sm:hover:scale-[1.02] ${
      isCurrentTariff ? 'border-primary border-2 shadow-lg' : 'hover:border-primary/50'
    } ${isPremium ? 'bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/20 dark:via-background dark:to-amber-950/20' : ''}`}>
      
      {/* Background decoration */}
      {isPremium && (
        <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-amber-400/10 rounded-full blur-3xl -translate-y-16 sm:-translate-y-20 translate-x-16 sm:translate-x-20" />
      )}
      
      {isCurrentTariff && (
        <Badge className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 bg-primary shadow-lg text-xs sm:text-sm">
          <Check className="w-3 h-3 mr-1" />
          Активний
        </Badge>
      )}
      
      <CardHeader className="relative p-4 sm:p-6">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
            isPremium ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-primary/10'
          }`}>
            <span className={`text-lg sm:text-xl font-bold ${isPremium ? 'text-white' : 'text-primary'}`}>
              {tariff.name.charAt(0)}
            </span>
          </div>
        </div>
        
        <CardTitle className="text-xl sm:text-2xl mb-2">{tariff.name}</CardTitle>
        <CardDescription className="text-xs sm:text-sm line-clamp-2">{tariff.description}</CardDescription>
        
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {tariff.price}
            </span>
            <span className="text-xl sm:text-2xl font-semibold text-muted-foreground">₴</span>
          </div>
          {tariff.duration_days && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              на {tariff.duration_days} {tariff.duration_days === 1 ? 'день' : tariff.duration_days < 5 ? 'дні' : 'днів'}
            </p>
          )}
          {tariff.is_trial && (
            <Badge variant="secondary" className="mt-2 text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400">
              Пробний період
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
        {/* Основні ліміти */}
        <div className="bg-muted/30 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sm:mb-3">Ліміти</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold">{tariff.channels_limit}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Каналів</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold">{tariff.bots_limit}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Ботів</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold">{tariff.posts_per_month}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Постів/міс</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold">{tariff.sources_limit}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Джерел</span>
            </div>
          </div>
          
        </div>

        {/* Функції - показуємо всі з можливістю розгортання */}
        {(() => {
          // Add AI Images as a feature to the list
          const aiImagesFeature: TariffFeature = {
            key: 'allow_ai_images',
            label: 'Зображення до АІ публікацій',
            enabled: tariff.allow_ai_images === true
          };
          const allFeatures = [...(tariff.features_list || []), aiImagesFeature];
          const totalEnabled = allFeatures.filter(f => f.enabled).length;
          
          return allFeatures.length > 0 && (
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Можливості ({totalEnabled}/{allFeatures.length})
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-[10px] sm:text-xs text-primary hover:underline flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    Згорнути <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    Всі функції <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              {allFeatures
                .slice(0, isExpanded ? undefined : 4)
                .map((feature) => (
                  <div 
                    key={feature.key} 
                    className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm rounded-md px-2 py-1 sm:py-1.5 ${
                      feature.enabled 
                        ? 'bg-green-500/10 border border-green-500/20' 
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    {feature.enabled ? (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className={`truncate ${feature.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {feature.label}
                    </span>
                  </div>
                ))
              }
              {!isExpanded && allFeatures.length > 4 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  className="w-full text-[10px] sm:text-xs text-muted-foreground text-center py-1 hover:text-primary transition-colors"
                >
                  +{allFeatures.length - 4} функцій • Натисніть щоб переглянути всі
                </button>
              )}
            </div>
          </div>
        );
        })()}
      </CardContent>

      <CardFooter className="pt-0 p-4 sm:p-6">
        <Button 
          onClick={() => onSelect(tariff)}
          className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold"
          disabled={isCurrentTariff}
          variant={isCurrentTariff ? "outline" : "default"}
        >
          {isCurrentTariff ? 'Активний тариф' : 'Обрати тариф'}
        </Button>
      </CardFooter>
    </Card>
  );
};
