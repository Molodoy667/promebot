import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { StaticPagesManagement } from "@/components/admin/StaticPagesManagement";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const PagesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase.rpc('has_role', {
      _user_id: session.user.id,
      _role: 'admin'
    });

    if (error || !data) {
      toast({
        title: "Доступ заборонено",
        description: "У вас немає прав адміністратора",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return <Loading message="Перевірка доступу..." />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Статичні сторінки</h1>
          <p className="text-muted-foreground mt-2">
            Створення та редагування статичних сторінок сайту
          </p>
        </div>

        <Card className="p-6 glass-effect border-border/50">
          <StaticPagesManagement />
        </Card>
      </div>
    </div>
  );
};

export default PagesPage;
