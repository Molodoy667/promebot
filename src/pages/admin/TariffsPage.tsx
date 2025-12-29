import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TariffsManagement } from "@/components/admin/TariffsManagement";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const TariffsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [editingTariff, setEditingTariff] = useState<any>(null);

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

    await loadTariffs();
    setIsLoading(false);
  };

  const loadTariffs = async () => {
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      setTariffs(data || []);
    } catch (error: any) {
      console.error("Error loading tariffs:", error);
    }
  };

  const handleEdit = (tariff: any) => {
    setEditingTariff(tariff);
    setActiveTab("edit");
  };

  const handleCreateNew = () => {
    setEditingTariff(null);
    setActiveTab("create");
  };

  const handleSuccess = () => {
    setActiveTab("list");
    setEditingTariff(null);
    loadTariffs();
  };

  if (isLoading) {
    return <Loading message="Перевірка доступу..." />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Управління тарифами</h1>
          <p className="text-muted-foreground mt-2">
            Створення та редагування тарифних планів
          </p>
        </div>

        <Card className="p-6 glass-effect border-border/50">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">Список тарифів</TabsTrigger>
              <TabsTrigger value="create">Створити тариф</TabsTrigger>
              <TabsTrigger value="edit" disabled={!editingTariff}>
                Редагувати тариф
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-6">
              <TariffsManagement 
                tariffs={tariffs} 
                onRefresh={loadTariffs}
                onEdit={handleEdit}
                onCreateNew={handleCreateNew}
              />
            </TabsContent>

            <TabsContent value="create" className="mt-6">
              <TariffsManagement 
                tariffs={tariffs}
                onRefresh={loadTariffs}
                mode="create"
                onSuccess={handleSuccess}
              />
            </TabsContent>

            <TabsContent value="edit" className="mt-6">
              {editingTariff && (
                <TariffsManagement 
                  tariffs={tariffs}
                  onRefresh={loadTariffs}
                  mode="edit"
                  editingTariff={editingTariff}
                  onSuccess={handleSuccess}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default TariffsPage;
