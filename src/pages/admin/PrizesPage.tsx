import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PrizesManagement } from "@/components/admin/PrizesManagement";

const PrizesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuthAndRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await checkUserRole(session.user.id);
  };

  const checkUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Доступ заборонено",
          description: "У вас немає прав адміністратора",
          variant: "destructive",
          duration: 1500,
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      console.error("Error checking role:", error);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Loading message="Перевірка доступу..." />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
      <PageBreadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Роздача призів</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Керування роздачею призів та бонусів користувачам
        </p>
      </div>

      <PrizesManagement />
    </div>
  );
};

export default PrizesPage;
