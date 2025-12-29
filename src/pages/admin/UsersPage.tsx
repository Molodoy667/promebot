import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { UsersManagement } from "@/components/admin/UsersManagement";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const UsersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
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

    await loadUsers();
    setIsLoading(false);
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  };

  if (isLoading) {
    return <Loading message="Перевірка доступу..." />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Управління користувачами</h1>
        <p className="text-muted-foreground mt-2">
          Перегляд та редагування користувачів системи
        </p>
      </div>

      <Card className="p-6 glass-effect border-border/50">
        <UsersManagement users={users} onRefresh={loadUsers} />
      </Card>
      </div>
    </div>
  );
};

export default UsersPage;
