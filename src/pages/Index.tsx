import { TariffCard } from "@/components/TariffCard";
import { CookieConsent } from "@/components/CookieConsent";
import { FAQSection } from "@/components/FAQSection";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Bot, Zap, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Loading } from "@/components/Loading";

interface TariffFeature {
  key: string;
  label: string;
  enabled: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { elementRef: heroRef, isVisible: isHeroVisible } = useScrollReveal();
  const { elementRef: featuresRef, isVisible: isFeaturesVisible } = useScrollReveal();
  const { elementRef: pricingRef, isVisible: isPricingVisible } = useScrollReveal();
  const { elementRef: faqRef, isVisible: isFaqVisible } = useScrollReveal();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Redirect authenticated users to dashboard
      if (currentUser) {
        navigate('/dashboard', { replace: true });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Redirect authenticated users to dashboard
      if (currentUser) {
        navigate('/dashboard', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ["tariffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Real-time updates for tariffs on home page
  useEffect(() => {
    const tariffsChannel = supabase
      .channel('home_tariffs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tariffs',
        },
        () => {
          console.log('Tariff changed, will be refetched by React Query');
          // React Query will automatically refetch
        }
      )
      .subscribe();

    return () => {
      tariffsChannel.unsubscribe();
    };
  }, []);

  const handleSelectTariff = () => {
    navigate("/auth");
  };

  return (
    <div className="relative">
      {/* Hero Section */}
      <section 
        ref={heroRef}
        className={`relative z-10 pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-4 transition-all duration-[1500ms] ease-out ${
          isHeroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-40'
        }`}
      >
        <div className="container mx-auto text-center max-w-4xl">
          <div 
            className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass-effect border border-primary/20 mb-6 sm:mb-8 hover:scale-105 transition-all duration-[1400ms] ease-out ${
              isHeroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-64'
            }`}
            style={{ transitionDelay: '0.2s' }}
          >
            <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary animate-pulse" />
            <span className="text-xs sm:text-sm text-muted-foreground">
              Автоматизація публікацій у Telegram
            </span>
          </div>
          
          <h1 
            className={`text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight transition-all duration-[1500ms] ease-out ${
              isHeroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-48'
            }`}
            style={{ transitionDelay: '0.3s' }}
          >
            Керуй своїм{" "}
            <span className="animate-gradient-text">
              Telegram-каналом
            </span>
            <br />
            автоматично
          </h1>
          
          <p 
            className={`text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto px-4 transition-all duration-[1500ms] ease-out ${
              isHeroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-40'
            }`}
            style={{ transitionDelay: '0.4s' }}
          >
            Копіюй пости з обраних каналів та публікуй їх у своєму каналі автоматично. 
            Налаштуй, запусти та спостерігай за зростанням.
          </p>

          <div 
            className={`flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 transition-all duration-[1500ms] ease-out ${
              isHeroVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-32 scale-90'
            }`}
            style={{ transitionDelay: '0.5s' }}
          >
            {!user && (
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="wave-effect text-base sm:text-lg px-6 sm:px-8 bg-gradient-primary hover:opacity-90 hover:scale-105 transition-all duration-300 shadow-glow hover:shadow-[0_0_60px_hsl(213_100%_75%/0.3)] w-full sm:w-auto"
              >
                Почати безкоштовно
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="wave-effect text-base sm:text-lg px-6 sm:px-8 border-primary/20 hover:bg-primary/10 hover:scale-105 hover:border-primary/40 transition-all duration-300 w-full sm:w-auto"
            >
              Переглянути тарифи
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        ref={featuresRef}
        id="features" 
        className="relative z-10 py-12 sm:py-16 md:py-20 px-4"
      >
        <div className="container mx-auto">
          <div 
            className={`text-center mb-10 sm:mb-12 md:mb-16 transition-all duration-[1500ms] ease-out ${
              isFeaturesVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-40'
            }`}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              <span className="animate-gradient-text">Чому обирають нас?</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
              Все необхідне для успішного керування Telegram-каналом
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <div 
              className={`group p-6 sm:p-8 rounded-2xl glass-effect border border-primary/10 transition-all duration-[1400ms] ease-out hover:border-primary/30 hover:scale-105 hover:shadow-[0_0_40px_hsl(213_93%_68%/0.2)] ${
                isFeaturesVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-64'
              }`}
              style={{ transitionDelay: '0.2s' }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-6 shadow-glow group-hover:shadow-[0_0_60px_hsl(213_100%_75%/0.3)] transition-all duration-500 group-hover:scale-110">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 group-hover:text-primary transition-colors duration-300">Автоматичне копіювання</h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Бот автоматично копіює пости з обраних каналів та публікує їх у твоєму каналі
              </p>
            </div>

            <div 
              className={`group p-6 sm:p-8 rounded-2xl glass-effect border border-primary/10 transition-all duration-[1400ms] ease-out hover:border-primary/30 hover:scale-105 hover:shadow-[0_0_40px_hsl(213_93%_68%/0.2)] ${
                isFeaturesVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-64'
              }`}
              style={{ transitionDelay: '0.4s' }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-6 shadow-glow group-hover:shadow-[0_0_60px_hsl(213_100%_75%/0.3)] transition-all duration-500 group-hover:scale-110">
                <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 group-hover:text-primary transition-colors duration-300">Гнучкі налаштування</h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Налаштуй частоту публікацій, фільтри та інші параметри під свої потреби
              </p>
            </div>

            <div 
              className={`group p-6 sm:p-8 rounded-2xl glass-effect border border-primary/10 transition-all duration-[1400ms] ease-out hover:border-primary/30 hover:scale-105 hover:shadow-[0_0_40px_hsl(213_93%_68%/0.2)] ${
                isFeaturesVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-64'
              }`}
              style={{ transitionDelay: '0.6s' }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-6 shadow-glow group-hover:shadow-[0_0_60px_hsl(213_100%_75%/0.3)] transition-all duration-500 group-hover:scale-110">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 group-hover:text-primary transition-colors duration-300">Детальна статистика</h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Відстежуй всі публікації та аналізуй ефективність свого каналу
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-12 sm:py-16 md:py-20 px-4">
        <div className="container mx-auto">
          <div 
            className={`text-center mb-10 sm:mb-12 md:mb-16 transition-all duration-[1500ms] ease-out ${
              isPricingVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-40 scale-90'
            }`}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              <span className="animate-gradient-text">Обери свій тариф</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-4">
              Прості та зрозумілі ціни для будь-яких потреб
            </p>
          </div>

          {isLoading ? (
            <Loading message="Завантаження тарифів..." />
          ) : (
            <div 
              ref={pricingRef}
              className={`max-w-6xl mx-auto px-4 sm:px-8 scroll-reveal ${isPricingVisible ? 'visible' : ''}`}
            >
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {tariffs?.filter(t => t && t.id).map((tariff, index) => (
                    <CarouselItem 
                      key={tariff.id} 
                      className="pl-4 basis-4/5 sm:basis-3/5 md:basis-1/2 lg:basis-1/3"
                      style={{ 
                        animationDelay: `${index * 0.2}s`,
                        opacity: isPricingVisible ? 1 : 0,
                        transform: isPricingVisible ? 'translateX(0)' : 'translateX(-120px)',
                        transition: `opacity 1.5s ease-out ${index * 0.2}s, transform 1.5s ease-out ${index * 0.2}s`
                      }}
                    >
                      <TariffCard
                        tariff={{
                          id: tariff.id,
                          name: tariff.name,
                          description: tariff.description || "",
                          price: Number(tariff.price),
                          channels_limit: tariff.channels_limit || 0,
                          bots_limit: tariff.bots_limit || 1,
                          posts_per_month: tariff.posts_per_month || 0,
                          sources_limit: tariff.sources_limit || 0,
                          duration_days: tariff.duration_days,
                          features_list: (tariff.features_list as any as TariffFeature[]) || [],
                          is_trial: tariff.is_trial || false,
                          allow_ai_images: tariff.allow_ai_images ?? true
                        }}
                        isCurrentTariff={false}
                        onSelect={handleSelectTariff}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4 md:-left-12 w-12 h-12 md:w-16 md:h-16" />
                <CarouselNext className="-right-4 md:-right-12 w-12 h-12 md:w-16 md:h-16" />
              </Carousel>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <div 
        ref={faqRef}
        className={`transition-all duration-[1500ms] ease-out ${
          isFaqVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-40'
        }`}
      >
        <FAQSection />
      </div>

      {/* Cookie Consent */}
      <CookieConsent />
    </div>
  );
};

export default Index;
