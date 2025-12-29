import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Lock, Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onProfileUpdate: () => void;
}

export const EditProfileDialog = ({
  open,
  onOpenChange,
  profile,
  onProfileUpdate,
}: EditProfileDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Помилка",
          description: "Розмір файлу не повинен перевищувати 5MB",
          variant: "destructive",
          duration: 1500,
        });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (userId: string) => {
    if (!avatarFile) return profile?.avatar_url;

    try {
      // Compress image before upload
      const compressedImage = await compressImage(avatarFile, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        maxSizeMB: 0.5,
      });

      const fileExt = compressedImage.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Delete old avatar from storage if it was uploaded to the avatars bucket
      if (profile?.avatar_url) {
        const marker = "/avatars/";
        const idx = profile.avatar_url.indexOf(marker);
        const oldStoragePath = idx !== -1 ? profile.avatar_url.slice(idx + marker.length) : null;

        if (oldStoragePath) {
          const { error: removeError } = await supabase.storage
            .from("avatars")
            .remove([oldStoragePath]);

          if (removeError) {
            console.warn("Error deleting old avatar:", removeError);
          }
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedImage, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Користувач не знайдений");

      // Upload avatar if changed
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user.id);
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email !== profile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });
        if (emailError) throw emailError;
      }

      toast({
        title: "Успіх",
        description: "Профіль оновлено",
        duration: 1500,
      });

      onProfileUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося оновити профіль",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Помилка",
        description: "Паролі не співпадають",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Помилка",
        description: "Пароль має містити мінімум 6 символів",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    setIsPasswordLoading(true);

    try {
      // Supabase validates current session automatically when updating password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) throw passwordError;

      toast({
        title: "Успіх",
        description: "Пароль успішно змінено",
        duration: 1500,
      });

      // Clear password fields
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося змінити пароль",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (profile?.avatar_url) return profile.avatar_url;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Редагувати профіль</DialogTitle>
          <DialogDescription>
            Змініть свої особисті дані
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24">
              <AvatarImage src={getAvatarUrl() || undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                {fullName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("avatar-upload")?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Завантажити фото
              </Button>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Повне ім'я
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Іван Іваненко"
              className="bg-background/60"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-background/60"
            />
            {email !== profile?.email && (
              <p className="text-xs text-warning">
                Буде надіслано лист підтвердження на новий email
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90 transition-smooth"
              disabled={isLoading}
            >
              {isLoading ? "Збереження..." : "Зберегти"}
            </Button>
          </div>
        </form>

        {/* Password Change Section */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-4">Зміна паролю</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Старий пароль
              </Label>
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Новий пароль
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/60"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Повторіть новий пароль
              </Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/60"
                minLength={6}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Паролі не співпадають</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
              disabled={isPasswordLoading || !oldPassword || !newPassword || !confirmPassword}
            >
              {isPasswordLoading ? "Збереження..." : "Змінити пароль"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
