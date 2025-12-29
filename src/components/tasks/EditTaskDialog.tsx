import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const taskSchema = z.object({
  title: z.string().min(5, "Назва повинна містити мінімум 5 символів"),
  description: z.string().min(20, "Опис повинен містити мінімум 20 символів"),
  reward_amount: z.number().min(0.5).max(10),
  task_type: z.enum(["bonus", "vip"]),
  max_completions: z.string(),
  requires_screenshot: z.boolean(),
  time_limit_hours: z.number().min(1).max(6),
  has_telegram_link: z.boolean(),
  telegram_channel_link: z.string().optional(),
  channel_info: z.any().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface EditTaskDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditTaskDialog = ({ task, open, onOpenChange }: EditTaskDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChannelInput, setShowChannelInput] = useState(!!task?.telegram_channel_link);
  const [channelLink, setChannelLink] = useState(task?.telegram_channel_link || "");
  const [isCheckingChannel, setIsCheckingChannel] = useState(false);
  const [channelInfo, setChannelInfo] = useState<any>(task?.channel_info || null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("balance, bonus_balance")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      reward_amount: task?.reward_amount || 0.5,
      task_type: task?.task_type || "bonus",
      max_completions: task?.max_completions ? "1" : "unlimited",
      requires_screenshot: task?.requires_screenshot || false,
      time_limit_hours: task?.time_limit_hours || 1,
      has_telegram_link: !!task?.telegram_channel_link,
      telegram_channel_link: task?.telegram_channel_link || "",
      channel_info: task?.channel_info || null,
    },
  });

  useEffect(() => {
    if (task && open) {
      form.reset({
        title: task.title,
        description: task.description,
        reward_amount: task.reward_amount,
        task_type: task.task_type,
        max_completions: task.max_completions ? "1" : "unlimited",
        requires_screenshot: task.requires_screenshot,
        time_limit_hours: task.time_limit_hours,
        has_telegram_link: !!task.telegram_channel_link,
        telegram_channel_link: task.telegram_channel_link || "",
        channel_info: task.channel_info || null,
      });
      setShowChannelInput(!!task.telegram_channel_link);
      setChannelLink(task.telegram_channel_link || "");
      setChannelInfo(task.channel_info || null);
    }
  }, [task, open, form]);

  const checkChannel = async () => {
    if (!channelLink) {
      toast({ title: "Помилка", description: "Введіть посилання на канал", variant: "destructive" });
      return;
    }

    setIsCheckingChannel(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-telegram-channel', {
        body: { channelLink },
      });

      if (error) throw error;

      setChannelInfo(data);
      form.setValue("telegram_channel_link", channelLink);
      form.setValue("channel_info", data);
      toast({ title: "Успішно", description: "Канал перевірено успішно" });
    } catch (error) {
      console.error("Error checking channel:", error);
      toast({ title: "Помилка", description: "Не вдалось перевірити канал", variant: "destructive" });
      setChannelInfo(null);
    } finally {
      setIsCheckingChannel(false);
    }
  };

  const updateTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("tasks")
        .update({
          title: data.title,
          description: data.description,
          reward_amount: data.reward_amount,
          task_type: data.task_type,
          max_completions: data.max_completions === "unlimited" ? null : 1,
          requires_screenshot: data.requires_screenshot,
          time_limit_hours: data.time_limit_hours,
          telegram_channel_link: data.has_telegram_link ? data.telegram_channel_link : null,
          channel_info: data.has_telegram_link ? data.channel_info : null,
          status: "pending_moderation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Завдання оновлено та відправлено на модерацію" });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message || "Не вдалось оновити завдання", variant: "destructive" });
    },
  });

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    await updateTaskMutation.mutateAsync(data);
    setIsSubmitting(false);
  };

  const taskType = form.watch("task_type");
  const availableBalance = taskType === "bonus" ? profile?.bonus_balance : profile?.balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редагувати завдання</DialogTitle>
          <DialogDescription>
            Після редагування завдання буде відправлено на повторну модерацію.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Назва завдання</FormLabel>
                  <FormControl>
                    <Input placeholder="Наприклад: Підписатись на Telegram канал" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Опис завдання</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Детально опишіть, що потрібно зробити..." 
                      rows={4}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="task_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип завдання</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bonus" id="edit-bonus" />
                        <label htmlFor="edit-bonus" className="cursor-pointer">
                          Бонусне (з бонусного балансу)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="vip" id="edit-vip" />
                        <label htmlFor="edit-vip" className="cursor-pointer">
                          VIP (з основного балансу)
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    Доступно: {availableBalance?.toFixed(2) || "0.00"} ₴
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reward_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Винагорода (0.50 - 10.00 ₴)</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.50"
                      value={field.value === 0 ? '' : field.value.toString()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          const numValue = value === '' ? 0 : parseFloat(value);
                          const clampedValue = Math.min(Math.max(numValue, 0), 10);
                          field.onChange(clampedValue);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_completions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Обмеження виконання</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unlimited">Безлімітно</SelectItem>
                      <SelectItem value="1">1 користувач → 1 виконання</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time_limit_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Час на виконання (годин)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((hours) => (
                        <SelectItem key={hours} value={hours.toString()}>
                          {hours} {hours === 1 ? "година" : "години"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_telegram_link"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setShowChannelInput(!!checked);
                        if (!checked) {
                          setChannelLink("");
                          setChannelInfo(null);
                          form.setValue("telegram_channel_link", "");
                          form.setValue("channel_info", null);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Додати посилання на Telegram канал
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {showChannelInput && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://t.me/your_channel або @your_channel"
                    value={channelLink}
                    onChange={(e) => setChannelLink(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={checkChannel}
                    disabled={isCheckingChannel}
                  >
                    {isCheckingChannel ? "Перевірка..." : "Перевірити"}
                  </Button>
                </div>

                {isCheckingChannel && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Перевірка доступності каналу...
                  </div>
                )}

                {channelInfo && (
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    {channelInfo.photo && (
                      <img
                        src={channelInfo.photo}
                        alt={channelInfo.title}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{channelInfo.title}</h4>
                      <p className="text-sm text-muted-foreground">@{channelInfo.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          channelInfo.isPublic 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {channelInfo.isPublic ? 'Публічний' : 'Приватний'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="requires_screenshot"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Вимагати скріншот виконання
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Скасувати
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Збереження..." : "Зберегти зміни"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

