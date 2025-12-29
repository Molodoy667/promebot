import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PromoCodesManagement } from "@/components/admin/PromoCodesManagement";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { useToast } from "@/components/ui/use-toast";

const PromoCodesPage = () => {
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
        <PromoCodesManagement />
      </div>
    </div>
  );
};

export default PromoCodesPage;
