import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TicketsManagement } from "@/components/admin/TicketsManagement";
import { TasksModeration } from "@/components/admin/TasksModeration";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { MessageSquare, Briefcase } from "lucide-react";

const Moderator = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkModeratorAccess();
  }, []);

  const checkModeratorAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has moderator or admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasModeratorAccess = roles?.some(r => r.role === "moderator" || r.role === "admin");
      
      if (!hasModeratorAccess) {
        navigate("/dashboard");
        return;
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/auth");
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Панель модератора</h1>
          <p className="text-muted-foreground mt-2">
            Керуйте тікетами підтримки, модеруйте завдання та відповідайте користувачам
          </p>
        </div>

        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Тікети підтримки
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Модерація завдань
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            <TicketsManagement />
          </TabsContent>

          <TabsContent value="tasks">
            <Card className="p-6 glass-effect border-border/50">
              <TasksModeration />
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Moderator;
