import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

interface StaticPageData {
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const StaticPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<StaticPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) {
      loadPage(slug);
    }
  }, [slug]);

  const loadPage = async (pageSlug: string) => {
    try {
      const { data, error } = await supabase
        .from("static_pages")
        .select("title, content, created_at, updated_at")
        .eq("slug", pageSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPage(data);
      }
    } catch (error) {
      console.error("Error loading page:", error);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Loading message="Завантаження..." />;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Сторінку не знайдено</h1>
          <p className="text-muted-foreground">Запитувана сторінка не існує або була видалена.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-8 glass-effect border-border/50">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {page?.title}
          </h1>
          
          <div className="text-sm text-muted-foreground mb-6">
            Оновлено: {new Date(page?.updated_at || "").toLocaleDateString("uk-UA")}
          </div>

          <div 
            className="prose prose-sm md:prose-base max-w-none text-foreground"
            style={{ 
              whiteSpace: "pre-wrap",
              lineHeight: "1.7"
            }}
          >
            {page?.content}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StaticPage;
