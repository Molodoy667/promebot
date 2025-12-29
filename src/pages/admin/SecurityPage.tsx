import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { RecaptchaSettings } from "@/components/admin/RecaptchaSettings";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const SecurityPage = () => {
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
          <h1 className="text-3xl font-bold">Налаштування безпеки</h1>
          <p className="text-muted-foreground mt-2">
            Управління reCAPTCHA, OAuth та захистом від ботів
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6 glass-effect border-border/50">
            <RecaptchaSettings />
          </Card>

          <Card className="p-6 glass-effect border-border/50">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Google OAuth</h3>
                <p className="text-sm text-muted-foreground">
                  Налаштовується в Supabase Dashboard → Authentication → Providers → Google
                </p>
              </div>
              <a
                href="https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/auth/providers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Відкрити налаштування Google OAuth →
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SecurityPage;
