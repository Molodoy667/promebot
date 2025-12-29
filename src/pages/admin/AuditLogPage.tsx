import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  History, 
  Search, 
  Filter, 
  Calendar,
  User,
  FileText,
  RefreshCw
} from "lucide-react";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const AuditLogPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, entityFilter],
    queryFn: async () => {
      // Since admin_audit_log table doesn't exist in types, return empty array
      // This is a placeholder - the table needs to be created via migration
      console.warn("admin_audit_log table not found in database types. Please create it via migration.");
      return [] as AuditLog[];
    },
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes("moderation")) return "bg-blue-500";
    if (action.includes("assigned") || action.includes("created")) return "bg-green-500";
    if (action.includes("removed") || action.includes("deleted")) return "bg-red-500";
    if (action.includes("modified") || action.includes("updated")) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const filteredLogs = logs?.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(search) ||
      log.entity_type.toLowerCase().includes(search) ||
      log.profiles?.full_name?.toLowerCase().includes(search) ||
      log.profiles?.email?.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return <Loading message="Завантаження логів..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs />
      
      {/* Header */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <History className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Журнал дій</h1>
              <p className="text-sm text-muted-foreground">
                Історія всіх дій адміністраторів та модераторів
              </p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Оновити
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Пошук..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Тип дії" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі дії</SelectItem>
              <SelectItem value="task_moderation">Модерація завдань</SelectItem>
              <SelectItem value="role_assigned">Призначення ролі</SelectItem>
              <SelectItem value="role_removed">Видалення ролі</SelectItem>
              <SelectItem value="balance_modified">Зміна балансу</SelectItem>
              <SelectItem value="settings_updated">Зміна налаштувань</SelectItem>
              <SelectItem value="ticket_assigned">Призначення тікета</SelectItem>
              <SelectItem value="ticket_unassigned">Відміна призначення</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Тип сутності" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі сутності</SelectItem>
              <SelectItem value="tasks">Завдання</SelectItem>
              <SelectItem value="user_roles">Ролі</SelectItem>
              <SelectItem value="profiles">Профілі</SelectItem>
              <SelectItem value="general_settings">Налаштування</SelectItem>
              <SelectItem value="tickets">Тікети</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Всього записів</p>
          <p className="text-2xl font-bold">{logs?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Унікальних користувачів</p>
          <p className="text-2xl font-bold">
            {new Set(logs?.map(l => l.user_id)).size || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">За сьогодні</p>
          <p className="text-2xl font-bold">
            {logs?.filter(l => 
              new Date(l.created_at).toDateString() === new Date().toDateString()
            ).length || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">За тиждень</p>
          <p className="text-2xl font-bold">
            {logs?.filter(l => {
              const logDate = new Date(l.created_at);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return logDate >= weekAgo;
            }).length || 0}
          </p>
        </Card>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs && filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <Card key={log.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {log.action.includes("task") ? <FileText className="w-5 h-5 text-primary" /> :
                   log.action.includes("role") ? <User className="w-5 h-5 text-primary" /> :
                   <History className="w-5 h-5 text-primary" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getActionBadgeColor(log.action)}>
                      {log.action}
                    </Badge>
                    <Badge variant="outline">{log.entity_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(log.created_at).toLocaleString("uk-UA")}
                    </span>
                  </div>

                  <p className="text-sm mb-2">
                    <span className="font-semibold">{log.profiles?.full_name || "Невідомий"}</span>
                    {" "}({log.profiles?.email})
                  </p>

                  {(log.old_values || log.new_values) && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {log.old_values && (
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                          <p className="font-semibold mb-1 text-red-500">Старі значення:</p>
                          <pre className="whitespace-pre-wrap break-all">
                            {formatValue(log.old_values)}
                          </pre>
                        </div>
                      )}
                      {log.new_values && (
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                          <p className="font-semibold mb-1 text-green-500">Нові значення:</p>
                          <pre className="whitespace-pre-wrap break-all">
                            {formatValue(log.new_values)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Записи не знайдені
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
