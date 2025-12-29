import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Globe, Zap, Clock } from "lucide-react";
import { mergeStats, getConfidenceColor, getConfidenceText, formatUpdateTime, isStatsFresh } from "@/lib/stats-merger";

interface StatsDisplayProps {
  post: {
    id: string;
    message_id?: number;
    views?: number;
    reactions?: number;
    scraping_stats?: any;
    mtproto_stats?: any;
  };
  showDetails?: boolean;
}

export const StatsDisplay = ({ post, showDetails = false }: StatsDisplayProps) => {
  const stats = mergeStats(post);
  const isFresh = isStatsFresh(stats.lastUpdated);

  const getSourceIcon = () => {
    switch (stats.source) {
      case 'mtproto':
        return <Eye className="w-3 h-3" />;
      case 'scraping':
        return <Globe className="w-3 h-3" />;
      case 'combined':
        return <Zap className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getSourceText = () => {
    switch (stats.source) {
      case 'mtproto':
        return 'MTProto Userbot';
      case 'scraping':
        return 'Web Scraping';
      case 'combined':
        return 'Гібридний (обидва методи)';
      default:
        return 'Невідомо';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Main Stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{stats.views.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">переглядів</span>
        </div>
        
        {stats.reactions > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-sm">❤️</span>
            <span className="text-sm">{stats.reactions}</span>
          </div>
        )}
        
        {stats.forwards > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-sm">↗️</span>
            <span className="text-sm">{stats.forwards}</span>
          </div>
        )}
      </div>

      {/* Source Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={stats.confidence === 'high' ? 'default' : 'outline'}
              className="gap-1 cursor-help"
            >
              {getSourceIcon()}
              {stats.hasBothMethods && <span className="text-xs">✓</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">{getSourceText()}</div>
              <div className={getConfidenceColor(stats.confidence)}>
                {getConfidenceText(stats.confidence)}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatUpdateTime(stats.lastUpdated)}
                {isFresh && <span className="text-green-500">• Свіжі дані</span>}
              </div>
              {stats.hasBothMethods && (
                <div className="pt-1 border-t">
                  Дані зібрані обома методами для максимальної точності
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Details (optional) */}
      {showDetails && stats.hasBothMethods && (
        <div className="ml-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {post.scraping_stats?.views || 0}
            <span className="mx-1">+</span>
            <Eye className="w-3 h-3" />
            {post.mtproto_stats?.views || 0}
          </span>
        </div>
      )}
    </div>
  );
};
