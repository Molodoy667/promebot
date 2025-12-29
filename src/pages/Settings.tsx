import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Mail, Lock, Upload, Loader2, CheckCircle2, AlertCircle, Bell, Shield, Info, Clock, Monitor, MapPin } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PageHeader } from "@/components/PageHeader";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general");
  
  // General Info
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loginHistory, setLoginHistory] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      loadProfile(session.user.id);
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setUsername(data.telegram_username || "");
      setFullName(data.full_name || "");
      setAvatarUrl(data.avatar_url || "");

      // Load login history
      loadLoginHistory(userId);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLoginHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "account_login")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLoginHistory(data || []);
    } catch (error) {
      console.error("Error loading login history:", error);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);

    try {
      // Delete old avatar from storage if exists
      if (avatarUrl && avatarUrl.includes('avatars/')) {
        try {
          const oldPath = avatarUrl.split('/avatars/')[1];
          if (oldPath) {
            await supabase.storage
              .from("avatars")
              .remove([`avatars/${oldPath}`]);
          }
        } catch (err) {
          console.error("Error deleting old avatar:", err);
          // Continue even if deletion fails
        }
      }

      const compressedFile = await compressImage(file);
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "Успіх",
        description: "Аватар оновлено",
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveGeneralInfo = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          full_name: fullName,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Успіх",
        description: "Загальна інформація оновлена",
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Помилка",
        description: "Паролі не співпадають",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Помилка",
        description: "Пароль має містити мінімум 6 символів",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Успіх",
        description: "Пароль змінено",
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {
      toast({
        title: "Помилка",
        description: "Введіть нову електронну адресу",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      setNewEmail("");

      toast({
        title: "Успіх",
        description: "Перевірте нову пошту для підтвердження",
      });
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          icon={User}
          title="Налаштування"
          description="Керуйте своїм профілем, безпекою та сповіщеннями"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              Загальна інформація
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Безпека
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Сповіщення
            </TabsTrigger>
          </TabsList>

          {/* General Information */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Загальна інформація</CardTitle>
                <CardDescription>
                  Оновіть свій профіль та персональну інформацію
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>
                      <User className="w-12 h-12" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                        {isUploadingAvatar ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>Завантажити аватар</span>
                      </div>
                    </Label>
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG, PNG або GIF. Максимум 5MB
                    </p>
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Нікнейм</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ваш нікнейм"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Повне ім'я</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ваше повне ім'я"
                  />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Електронна пошта</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Для зміни email перейдіть в розділ "Безпека"
                  </p>
                </div>

                <Button onClick={handleSaveGeneralInfo} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Збереження...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Зберегти зміни
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle>Зміна паролю</CardTitle>
                  <CardDescription>
                    Оновіть свій пароль для підвищення безпеки
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новий пароль</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Введіть новий пароль"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Підтвердіть пароль</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторіть новий пароль"
                    />
                  </div>

                  <Button onClick={handleChangePassword} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Зміна...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Змінити пароль
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Change Email */}
              <Card>
                <CardHeader>
                  <CardTitle>Зміна електронної пошти</CardTitle>
                  <CardDescription>
                    Оновіть свою електронну адресу
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentEmail">Поточна пошта</Label>
                    <Input
                      id="currentEmail"
                      type="email"
                      value={user?.email || ""}
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Нова електронна пошта</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Введіть нову пошту"
                    />
                  </div>

                  <Button onClick={handleChangeEmail} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Зміна...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Змінити email
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Login History */}
              <Card>
                <CardHeader>
                  <CardTitle>Історія авторизацій</CardTitle>
                  <CardDescription>
                    Останні 50 входів у ваш обліковий запис
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loginHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Історія авторизацій порожня
                    </p>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {loginHistory.map((log) => {
                        const metadata = log.metadata || {};
                        const date = new Date(log.created_at);
                        
                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Monitor className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="font-medium text-sm">
                                  {log.title || "Вхід в систему"}
                                </p>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {date.toLocaleString("uk-UA", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {log.message}
                              </p>
                              {metadata.ip && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  <span>IP: {metadata.ip}</span>
                                  {metadata.location && (
                                    <>
                                      <span>•</span>
                                      <span>{metadata.location}</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Налаштування сповіщень</CardTitle>
                <CardDescription>
                  Керуйте тим, які сповіщення ви хочете отримувати
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationSettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
