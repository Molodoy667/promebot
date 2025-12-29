import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaticPage {
  slug: string;
  title: string;
  content: string;
}

export default function Info() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const { data, error } = await supabase
        .from("static_pages")
        .select("slug, title, content")
        .eq("is_active", true)
        .eq("show_in_footer", true)
        .order("display_order", { ascending: true });

      if (!error && data) {
        setPages(data);
      }
    } catch (error) {
      console.error("Error loading pages:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Загальна інформація
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Завантаження...
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Інформаційні сторінки не знайдено</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div className="space-y-6 pr-4">
                {/* Навігаційні посилання */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <span className="font-medium">Dashboard</span>
                  </Link>
                  <Link
                    to="/reviews"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <span className="font-medium">Відгуки</span>
                  </Link>
                  <Link
                    to="/referral"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <span className="font-medium">Реферальна програма</span>
                  </Link>
                  <Link
                    to="/terms"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <span className="font-medium">Умови використання</span>
                  </Link>
                </div>

                {/* Статичні сторінки */}
                <div className="space-y-6 mt-8">
                  <h2 className="text-xl font-semibold border-b pb-2">Додаткова інформація</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pages.map((page) => (
                      <Link
                        key={page.slug}
                        to={`/page/${page.slug}`}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="font-medium">{page.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
