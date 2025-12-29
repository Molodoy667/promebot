import { useLocation, Link } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Мапа для перекладу маршрутів
const routeLabels: Record<string, string> = {
  "": "Головна",
  "dashboard": "Кабінет",
  "profile": "Налаштування профілю",
  "my-channels": "Мої канали",
  "bot-setup": "Налаштування бота",
  "channel-stats": "Статистика каналу",
  "channel-posts": "Пости каналу",
  "queue-management": "Управління чергою",
  "referral": "Реферальна програма",
  "roulette": "Рулетка удачі",
  "entertainment": "Розваги",
  "task-marketplace": "Біржа завдань",
  "create-task": "Створити завдання",
  "tickets": "Підтримка",
  "create-ticket": "Створити тікет",
  "vip-chat": "VIP чат",
  "tools": "Інструменти",
  "ai-chat": "AI Чат",
  "miner-game": "Майнер гра",
  "analytics": "Аналітика",
  "reviews": "Відгуки",
  "settings": "Налаштування",
  "notifications": "Сповіщення",
  "info": "Інформація",
  "admin": "Адміністрування",
  "moderator": "Модерація",
  "auth": "Авторизація",
  "terms": "Умови використання",
  "users": "Користувачі",
  "bots": "Telegram Боти",
  "channels": "Канали",
  "tariffs": "Тарифи",
  "tasks": "Завдання",
  "general": "Загальні налаштування",
  "telegram-auth": "Telegram Auth",
  "limits": "Ліміти Supabase",
  "pages": "Статичні сторінки",
  "security": "Безпека",
  "vip": "VIP Підписка",
  "tickets-admin": "Управління тікетами",
  "edit": "Редагувати",
  "create": "Створити",
};

export const PageBreadcrumbs = () => {
  const location = useLocation();
  let pathnames = location.pathname.split("/").filter((x) => x);
  const isMobile = useIsMobile();

  // Не показувати breadcrumbs на головній сторінці та dashboard
  if (pathnames.length === 0 || (pathnames.length === 1 && pathnames[0] === "dashboard")) {
    return null;
  }

  // Додати "dashboard" (Кабінет) на початок для user pages
  const userPages = ["my-channels", "bot-setup", "referral", "roulette", "entertainment", 
                     "task-marketplace", "tickets", "vip-chat", "tools", "ai-chat", 
                     "miner-game", "analytics", "reviews", "settings", "notifications", 
                     "info", "channel-stats", "channel-posts", "queue-management"];
  
  const firstSegment = pathnames[0];
  
  // Якщо це user page і немає dashboard на початку - додаємо
  if (userPages.includes(firstSegment)) {
    pathnames = ["dashboard", ...pathnames];
  }

  // Генерація Schema.org структурованих даних
  const baseUrl = window.location.origin;
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": routeLabels[""],
      "item": `${baseUrl}/dashboard`
    }
  ];

  let currentPath = "";
  pathnames.forEach((value, index) => {
    currentPath += `/${value}`;
    let label = routeLabels[value] || value.charAt(0).toUpperCase() + value.slice(1);
    
    // Спеціальна логіка для динамічних ID
    if (value.match(/^[0-9a-f-]{36}$/i)) {
      // UUID - пропускаємо або використовуємо контекст
      return;
    }
    
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": index + 2,
      "name": label,
      "item": `${baseUrl}${currentPath}`
    });
  });

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems
  };

  // Логіка згортання для мобільних
  const shouldCollapse = isMobile && pathnames.length > 2;
  const displayItems = shouldCollapse 
    ? [pathnames[0], pathnames[pathnames.length - 1]]
    : pathnames;

  return (
    <TooltipProvider>
      {/* Schema.org структуровані дані */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      
      <div 
        key={location.pathname}
        className="container mx-auto px-4 py-4 animate-fade-in"
      >
        <div className="glass-effect border border-border/30 rounded-xl p-3 shadow-sm backdrop-blur-sm transition-all duration-300">
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BreadcrumbLink asChild>
                      <Link 
                        to="/dashboard" 
                        className="flex items-center gap-1.5 group transition-all duration-300 hover:scale-105"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow group-hover:shadow-xl transition-all duration-300">
                          <Home className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="hidden sm:inline text-sm font-medium bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent group-hover:from-primary-glow group-hover:to-primary transition-all duration-300">
                          {routeLabels[""]}
                        </span>
                      </Link>
                    </BreadcrumbLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{routeLabels[""]}</p>
                  </TooltipContent>
                </Tooltip>
              </BreadcrumbItem>

              {shouldCollapse && pathnames.length > 2 && (
                <>
                  <BreadcrumbSeparator>
                    <ChevronRight className="w-4 h-4 text-primary/40" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbEllipsis className="text-muted-foreground" />
                  </BreadcrumbItem>
                </>
              )}

              {displayItems.map((value, index) => {
                const actualIndex = shouldCollapse && index === 1 ? pathnames.length - 1 : index;
                
                // Пропустити UUID
                if (value.match(/^[0-9a-f-]{36}$/i)) {
                  return null;
                }
                
                // Обчислення правильного шляху
                const to = `/${pathnames.slice(0, actualIndex + 1).join("/")}`;
                
                // Отримати label
                let label = routeLabels[value] || value.charAt(0).toUpperCase() + value.slice(1);
                
                const isLast = actualIndex === pathnames.length - 1;

                return (
                  <div 
                    key={`${to}-${index}`} 
                    className="flex items-center animate-fade-in" 
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <BreadcrumbSeparator>
                      <ChevronRight className="w-4 h-4 text-primary/40 animate-pulse" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {isLast ? (
                            <BreadcrumbPage className="text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 transition-all duration-300">
                              {label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link 
                                to={to} 
                                className="text-sm font-medium text-muted-foreground hover:text-primary transition-all duration-300 px-3 py-1.5 rounded-lg hover:bg-primary/5 hover:scale-105 hover:shadow-sm"
                              >
                                {label}
                              </Link>
                            </BreadcrumbLink>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </BreadcrumbItem>
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </TooltipProvider>
  );
};
