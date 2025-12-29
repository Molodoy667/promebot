import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, X, Send, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { compressImage } from "@/lib/imageCompression";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface FileWithPreview {
  file: File;
  preview: string;
  progress: number;
}

const CreateTicket = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      
      // Compress images before adding to state
      const compressedFiles = await Promise.all(
        fileArray.map(async (file) => {
          try {
            const compressed = await compressImage(file, {
              maxWidth: 1920,
              maxHeight: 1920,
              quality: 0.8,
              maxSizeMB: 1,
            });
            return {
              file: compressed,
              preview: URL.createObjectURL(compressed),
              progress: 0,
            };
          } catch (error) {
            console.error('Error compressing image:', error);
            // Fallback to original file if compression fails
            return {
              file,
              preview: URL.createObjectURL(file),
              progress: 0,
            };
          }
        })
      );
      
      setFiles(prev => [...prev, ...compressedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const createTicket = async () => {
    if (!user || !subject.trim() || !description.trim()) {
      toast({
        title: "Помилка",
        description: "Заповніть всі обов'язкові поля",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create ticket
      const { data: ticketData, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          description: description.trim(),
          priority,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial message with description
      const { data: messageData, error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticketData.id,
          user_id: user.id,
          message: description.trim(),
          is_admin_reply: false,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload attachments with progress
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const fileData = files[i];
          const filePath = `${user.id}/${ticketData.id}/${Date.now()}_${fileData.file.name}`;
          
          // Update progress
          setFiles(prev => {
            const newFiles = [...prev];
            newFiles[i] = { ...newFiles[i], progress: 50 };
            return newFiles;
          });

          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(filePath, fileData.file);

          if (!uploadError) {
            await supabase.from("ticket_attachments").insert({
              ticket_id: ticketData.id,
              message_id: messageData.id,
              file_name: fileData.file.name,
              file_path: filePath,
              file_size: fileData.file.size,
            });

            // Update progress to complete
            setFiles(prev => {
              const newFiles = [...prev];
              newFiles[i] = { ...newFiles[i], progress: 100 };
              return newFiles;
            });
          }
        }
      }

      toast({
        title: "Успішно",
        description: "Тікет створено",
      });

      navigate("/tickets");
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося створити тікет",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <PageHeader
          icon={Send}
          title="Створити новий тікет"
          description="Опишіть вашу проблему або питання - наша команда підтримки допоможе вам"
          backTo="/tickets"
          backLabel="Назад до тікетів"
        />

        {/* Form Card */}
        <Card className="p-6 space-y-6 animate-fade-in">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-base font-medium">
              Тема <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Коротко опишіть проблему"
              className="text-base"
              disabled={isSubmitting}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-base font-medium">
              Пріоритет <span className="text-destructive">*</span>
            </Label>
            <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
              <SelectTrigger className="text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Низький</SelectItem>
                <SelectItem value="medium">🔵 Середній</SelectItem>
                <SelectItem value="high">🟠 Високий</SelectItem>
                <SelectItem value="urgent">🔴 Терміновий</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-medium">
              Детальний опис <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Детально опишіть вашу проблему або запитання"
              rows={8}
              className="text-base resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Прикріплені файли</Label>
            
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isSubmitting}
            />

            {files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {files.map((fileData, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-border">
                      <img
                        src={fileData.preview}
                        alt={fileData.file.name}
                        className="w-full h-full object-cover"
                      />
                      {fileData.progress > 0 && fileData.progress < 100 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-3/4">
                            <Progress value={fileData.progress} className="h-2" />
                          </div>
                        </div>
                      )}
                    </div>
                    {!isSubmitting && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-xs text-white truncate">{fileData.file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-base py-6"
              disabled={isSubmitting}
            >
              <ImageIcon className="w-5 h-5 mr-2" />
              Додати фото
            </Button>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/tickets")}
              className="flex-1 text-base py-6"
              disabled={isSubmitting}
            >
              Скасувати
            </Button>
            <Button
              onClick={createTicket}
              className="flex-1 bg-gradient-primary hover:opacity-90 text-base py-6"
              disabled={isSubmitting || !subject.trim() || !description.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Створення...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Створити тікет
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CreateTicket;
