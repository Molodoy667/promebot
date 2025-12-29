import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit, Trash2, Plus, Shield, UserX, Crown, Mail, Phone, Calendar, Wallet, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserMobileCard } from "./UserMobileCard";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  balance: number;
  bonus_balance: number;
  phone: string | null;
  referral_code: string | null;
  created_at: string;
}

interface UsersManagementProps {
  users: User[];
  onRefresh: () => void;
}

export const UsersManagement = ({ users, onRefresh }: UsersManagementProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isVipDialogOpen, setIsVipDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [vipExpiryDate, setVipExpiryDate] = useState<string | null>(null);
  const [vipDaysToAdd, setVipDaysToAdd] = useState("30");
  const [editData, setEditData] = useState({
    full_name: "",
    email: "",
    balance: "",
    bonus_balance: "",
    phone: "",
  });

  const filteredUsers = users.filter((user) => {
    const email = user.email ? user.email.toLowerCase() : "";
    const fullName = user.full_name ? user.full_name.toLowerCase() : "";
    const term = searchTerm.toLowerCase();

    return email.includes(term) || fullName.includes(term);
  });

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editData.full_name,
          email: editData.email,
          balance: parseFloat(editData.balance),
          bonus_balance: parseFloat(editData.bonus_balance),
          phone: editData.phone || null,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast({
        title: "Користувача оновлено",
        description: "Дані користувача успішно змінено",
        duration: 1500,
      });

      setIsEditDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const [selectedRole, setSelectedRole] = useState<string>("");

  const loadUserRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .neq("role", "user");

      if (data && data.length > 0) {
        setSelectedRole(data[0].role);
      } else {
        setSelectedRole("none");
      }
    } catch (error) {
      console.error("Error loading role:", error);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      // Видалити всі спеціальні ролі (admin, moderator)
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id)
        .neq("role", "user");

      // Додати нову роль якщо не "none"
      if (selectedRole !== "none") {
        await supabase
          .from("user_roles")
          .insert({
            user_id: selectedUser.id,
            role: selectedRole as "admin" | "moderator",
          });
      }

      toast({
        title: "Роль оновлено",
        description: `Роль користувача успішно змінено на ${selectedRole === "none" ? "Користувач" : selectedRole === "admin" ? "Адміністратор" : "Модератор"}`,
        duration: 1500,
      });

      setIsRoleDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Ви впевнені, що хочете видалити користувача ${user.email}? Цю дію не можна скасувати.`)) {
      return;
    }

    try {
      // Видалити профіль (це також видалить користувача з auth.users через тригер)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Користувача видалено",
        description: "Користувач успішно видалений з системи",
        duration: 2000,
      });

      onRefresh();
    } catch (error: any) {
      toast({
        title: "Помилка видалення",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditData({
      full_name: user.full_name || "",
      email: user.email,
      balance: user.balance.toString(),
      bonus_balance: user.bonus_balance.toString(),
      phone: user.phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const openRoleDialog = async (user: User) => {
    setSelectedUser(user);
    await loadUserRole(user.id);
    setIsRoleDialogOpen(true);
  };

  const loadVipStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("vip_subscriptions")
        .select("expires_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (data) {
        setVipExpiryDate(data.expires_at);
      } else {
        setVipExpiryDate(null);
      }
    } catch (error) {
      console.error("Error loading VIP status:", error);
      setVipExpiryDate(null);
    }
  };

  const openVipDialog = async (user: User) => {
    setSelectedUser(user);
    setVipDaysToAdd("30");
    await loadVipStatus(user.id);
    setIsVipDialogOpen(true);
  };

  const handleAddVipDays = async () => {
    if (!selectedUser) return;

    const days = parseInt(vipDaysToAdd);
    if (isNaN(days) || days <= 0) {
      toast({ title: "Помилка", description: "Введіть коректну кількість днів", variant: "destructive" });
      return;
    }

    try {
      let newExpiryDate: Date;

      if (vipExpiryDate) {
        // Продовжити існуючу підписку
        const currentExpiry = new Date(vipExpiryDate);
        newExpiryDate = new Date(currentExpiry);
        newExpiryDate.setDate(newExpiryDate.getDate() + days);

        const { error } = await supabase
          .from("vip_subscriptions")
          .update({ expires_at: newExpiryDate.toISOString() })
          .eq("user_id", selectedUser.id);

        if (error) throw error;
      } else {
        // Створити нову підписку
        newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + days);

        const { error } = await supabase
          .from("vip_subscriptions")
          .insert({
            user_id: selectedUser.id,
            expires_at: newExpiryDate.toISOString(),
          });

        if (error) throw error;
      }

      const formattedDate = newExpiryDate.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      toast({ title: "Успішно", description: `VIP статус оновлено до ${formattedDate}` });
      setIsVipDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Помилка", description: "Помилка оновлення VIP статусу", variant: "destructive" });
      console.error(error);
    }
  };

  const handleCancelVip = async () => {
    if (!selectedUser || !vipExpiryDate) return;

    if (!confirm("Ви впевнені, що хочете анулювати VIP статус цього користувача?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("vip_subscriptions")
        .delete()
        .eq("user_id", selectedUser.id);

      if (error) throw error;

      toast({ title: "Успішно", description: "VIP статус анульовано" });
      setIsVipDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({ title: "Помилка", description: "Помилка анулювання VIP статусу", variant: "destructive" });
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Пошук користувачів..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Всього: {users.length}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                "https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/auth/users",
                "_blank"
              )
            }
            className="border-primary/20 hover:bg-primary/10"
          >
            Supabase Auth
          </Button>
        </div>
      </div>

      {/* Desktop - Table View */}
      {!isMobile && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Користувач</TableHead>
                <TableHead className="font-semibold">Баланс</TableHead>
                <TableHead className="font-semibold">Реферальний код</TableHead>
                <TableHead className="font-semibold">Дата реєстрації</TableHead>
                <TableHead className="font-semibold text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Користувачів не знайдено
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.full_name || "—"}</span>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <code className="text-xs text-muted-foreground">
                          ID: {user.id.slice(0, 8)}...
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="font-semibold w-fit">
                          {user.balance.toFixed(2)} ₴
                        </Badge>
                        <Badge variant="outline" className="font-semibold w-fit text-xs">
                          Бонус: {user.bonus_balance.toFixed(2)} ₴
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {user.referral_code}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("uk-UA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openVipDialog(user)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          VIP
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRoleDialog(user)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Ролі
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Редагувати
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Mobile - Card View */}
      {isMobile && (
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              Користувачів не знайдено
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <UserMobileCard
                key={user.id}
                user={user}
                onEdit={openEditDialog}
                onManageRole={openRoleDialog}
                onManageVip={openVipDialog}
              />
            ))
          )}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редагувати користувача</DialogTitle>
            <DialogDescription>
              ID: {selectedUser?.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Повне ім'я</Label>
              <Input
                id="full_name"
                value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                placeholder="Іван Іванов"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                placeholder="+380..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Баланс (₴)</Label>
              <Input
                id="balance"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={editData.balance}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setEditData({ ...editData, balance: value });
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonus_balance">Бонусний баланс (₴)</Label>
              <Input
                id="bonus_balance"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={editData.bonus_balance}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setEditData({ ...editData, bonus_balance: value });
                  }
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleEditUser}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Керування ролями</DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Виберіть роль для користувача
            </p>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Виберіть роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Користувач</SelectItem>
                <SelectItem value="moderator">Модератор</SelectItem>
                <SelectItem value="admin">Адміністратор</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Користувач:</strong> Базові можливості</p>
              <p><strong>Модератор:</strong> Може переглядати та відповідати на тікети</p>
              <p><strong>Адміністратор:</strong> Повний доступ до панелі адміна</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleUpdateRole}>
              <Shield className="w-4 h-4 mr-2" />
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIP Management Dialog */}
      <Dialog open={isVipDialogOpen} onOpenChange={setIsVipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              Керування VIP статусом
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {vipExpiryDate ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-900">
                  VIP активний до:{" "}
                  {new Date(vipExpiryDate).toLocaleDateString("uk-UA", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  У користувача немає активного VIP статусу
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="vip_days">
                {vipExpiryDate ? "Додати днів до підписки" : "Кількість днів VIP"}
              </Label>
              <Input
                id="vip_days"
                type="text"
                value={vipDaysToAdd}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || !isNaN(parseInt(value))) {
                    setVipDaysToAdd(value);
                  }
                }}
                placeholder="30"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVipDaysToAdd("7")} size="sm">
                7 днів
              </Button>
              <Button variant="outline" onClick={() => setVipDaysToAdd("14")} size="sm">
                14 днів
              </Button>
              <Button variant="outline" onClick={() => setVipDaysToAdd("30")} size="sm">
                30 днів
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {vipExpiryDate && (
              <Button
                variant="destructive"
                onClick={handleCancelVip}
                className="w-full sm:w-auto"
              >
                <UserX className="w-4 h-4 mr-2" />
                Анулювати VIP
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setIsVipDialogOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Скасувати
              </Button>
              <Button
                onClick={handleAddVipDays}
                className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              >
                <Crown className="w-4 h-4 mr-2" />
                {vipExpiryDate ? "Продовжити" : "Додати"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


