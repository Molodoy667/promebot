import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

const submitSchema = z.object({
  report_text: z.string().min(20, "Звіт повинен містити мінімум 20 символів"),
  screenshot: z.any().optional(),
});

type SubmitFormData = z.infer<typeof submitSchema>;

interface SubmitTaskDialogProps {
  submission: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SubmitTaskDialog = ({ submission, open, onOpenChange }: SubmitTaskDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const task = submission.task;

  const form = useForm<SubmitFormData>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      report_text: submission.report_text || "",
    },
  });

  const submitTaskMutation = useMutation({
    mutationFn: async (data: SubmitFormData) => {
      let screenshotUrl = submission.screenshot_url;

      // Upload screenshot if provided
      if (screenshot) {
        // Compress image before upload
        const compressedImage = await compressImage(screenshot, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          maxSizeMB: 1,
        });

        const fileExt = compressedImage.name.split(".").pop();
        const fileName = `${submission.id}-${Date.now()}.${fileExt}`;
        const filePath = `${submission.user_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, compressedImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("ticket-attachments")
          .getPublicUrl(filePath);

        screenshotUrl = urlData.publicUrl;
      }

      // Validate required screenshot
      if (task.requires_screenshot && !screenshotUrl) {
        throw new Error("Для цього завдання обов'язковий скріншот");
      }

      const { error } = await supabase
        .from("task_submissions")
        .update({
          status: "submitted",
          report_text: data.report_text,
          screenshot_url: screenshotUrl,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", submission.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Звіт подано!",
        description: "Очікуйте перевірки.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["task-submissions", task.id] });
      form.reset();
      setScreenshot(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось подати звіт",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SubmitFormData) => {
    setIsSubmitting(true);
    await submitTaskMutation.mutateAsync(data);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Подати звіт про виконання</DialogTitle>
          <DialogDescription>
            {task.title}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="report_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Звіт про виконання</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Детально опишіть, як ви виконали завдання..."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {task.requires_screenshot && (
              <FormField
                control={form.control}
                name="screenshot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Скріншот підтвердження <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setScreenshot(file);
                              field.onChange(file);
                            }
                          }}
                          required
                        />
                        {screenshot && (
                          <p className="text-sm text-muted-foreground">
                            Обрано: {screenshot.name}
                          </p>
                        )}
                        {submission.screenshot_url && !screenshot && (
                          <p className="text-sm text-muted-foreground">
                            Скріншот вже завантажено
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Скасувати
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || (task.requires_screenshot && !screenshot && !submission.screenshot_url)}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isSubmitting ? "Подання..." : "Подати звіт"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
