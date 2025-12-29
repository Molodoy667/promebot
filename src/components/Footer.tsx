import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Bot } from "lucide-react";

interface StaticPage {
  slug: string;
  title: string;
}

export const Footer = () => {
  const [footerPages, setFooterPages] = useState<StaticPage[]>([]);
  const { settings } = useGeneralSettings();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadFooterPages();
  }, []);

  const loadFooterPages = async () => {
    try {
      const { data, error } = await supabase
        .from("static_pages")
        .select("slug, title")
        .eq("is_active", true)
        .eq("show_in_footer", true)
        .order("display_order", { ascending: true });

      if (!error && data) {
        setFooterPages(data);
      }
    } catch (error) {
      console.error("Error loading footer pages:", error);
    }
  };

  return (
    <footer className="relative border-t border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-gradient-slow opacity-50"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--primary)/0.1),transparent_50%)] animate-pulse-slow"></div>
      <div className="container mx-auto px-4 py-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Description */}
          <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <Link to="/" className="flex items-center gap-2 mb-4 group">
              {settings.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt={settings.site_name} 
                  className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-glow">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="text-xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                {settings.site_name || "TelePostBot"}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {settings.site_description || "Автоматизація публікацій в Telegram каналах"}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h3 className="text-sm font-semibold text-foreground mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Навігація
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/dashboard" 
                  className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1 story-link"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  to="/reviews" 
                  className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1 story-link"
                >
                  Відгуки
                </Link>
              </li>
              <li>
                <Link 
                  to="/referral" 
                  className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1 story-link"
                >
                  Реферальна програма
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1 story-link"
                >
                  Умови використання
                </Link>
              </li>
            </ul>
          </div>

          {/* Static Pages */}
          {footerPages.length > 0 && (
            <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <h3 className="text-sm font-semibold text-foreground mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Інформація
              </h3>
              <ul className="space-y-2">
                {footerPages.map((page, index) => (
                  <li key={page.slug} className="animate-fade-in" style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
                    <Link 
                      to={`/page/${page.slug}`} 
                      className="text-sm text-muted-foreground hover:text-primary transition-all duration-300 inline-block hover:translate-x-1 story-link"
                    >
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-border/50 text-center animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <p className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            © {currentYear} {settings.site_name || "TelePostBot"}. Всі права захищені.
          </p>
        </div>
      </div>
    </footer>
  );
};
