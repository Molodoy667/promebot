import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
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
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CategorySelector, CategoryOption } from "@/components/CategorySelector";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { 
  ArrowLeft, 
  Briefcase, 
  MessageCircle, 
  Eye, 
  ThumbsUp, 
  Share2, 
  FileText, 
  TestTube,
  Send,
  AlertCircle,
  Sparkles,
  DollarSign,
  Clock,
  Camera,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Link as LinkIcon,
  Plus
} from "lucide-react";

const taskCategories: CategoryOption[] = [
  {
    value: "telegram_subscription",
    label: "Підписка на Telegram канал",
    icon: MessageCircle,
    description: "Користувач повинен підписатися на ваш Telegram канал"
  },
  {
    value: "telegram_view",
    label: "Перегляд посту в Telegram",
    icon: Eye,
    description: "Користувач повинен переглянути конкретний пост"
  },
  {
    value: "telegram_reaction",
    label: "Реакція на пост в Telegram",
    icon: ThumbsUp,
    description: "Користувач повинен поставити реакцію на пост"
  },
  {
    value: "social_media",
    label: "Соціальні мережі",
    icon: Share2,
    description: "Завдання пов'язані з іншими соц. мережами"
  },
  {
    value: "content_creation",
    label: "Створення контенту",
    icon: FileText,
    description: "Написати відгук, коментар тощо"
  },
  {
    value: "testing",
    label: "Тестування",
    icon: TestTube,
    description: "Протестувати сервіс або додаток"
  },
  {
    value: "general",
    label: "Загальне",
    icon: Briefcase,
    description: "Інші типи завдань"
  },
];

const taskSchema = z.object({
  title: z
    .string()
    .min(5, "Назва повинна містити мінімум 5 символів")
    .max(100, "Назва не може бути довшою за 100 символів"),
  description: z
    .string()
    .min(20, "Опис повинен містити мінімум 20 символів")
    .max(1000, "Опис не може бути довшим за 1000 символів"),
  category: z.string().min(1, "Оберіть категорію"),
  reward_amount: z
    .coerce
    .number({
      required_error: "Вкажіть винагороду",
      invalid_type_error: "Винагорода повинна бути числом",
    })
    .min(0.25, "Мінімальна винагорода 0.25 грн")
    .max(10, "Максимальна винагорода 10 грн"),
  time_limit_hours: z
    .coerce
    .number({
      required_error: "Вкажіть час на виконання",
      invalid_type_error: "Час повинен бути числом",
    })
    .min(1, "Мінімум 1 година")
    .max(6, "Максимум 6 годин"),
  requires_screenshot: z.boolean(),
  max_completions: z.coerce.number().optional(),
  telegram_channel_link: z.string()
    .refine((val) => {
      if (!val) return true; // Optional field
      // Accept t.me links, @username, or plain username
      return val.includes('t.me/') || 
             val.startsWith('@') || 
             (!val.includes('/') && !val.includes('http'));
    }, "Введіть посилання t.me/канал, @username або просто username")
    .optional()
    .or(z.literal("")),
  task_type: z.string(),
  balance_type: z.enum(["bonus", "main"]),
});

type TaskFormData = z.infer<typeof taskSchema>;

const CreateTask = () => {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const { toast } = useToast();
  const isEditMode = !!taskId;
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [channelLink, setChannelLink] = useState<string>("");
  const [channelInfo, setChannelInfo] = useState<any>(null);
  const [isCheckingChannel, setIsCheckingChannel] = useState(false);
  const [hasAttemptedCheck, setHasAttemptedCheck] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      reward_amount: 0.25,
      time_limit_hours: 1,
      requires_screenshot: true,
      max_completions: 1,
      telegram_channel_link: "",
      task_type: "general",
      balance_type: "bonus",
    },
  });

  // Load task data if editing
  const { data: existingTask } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingTask && isEditMode) {
      form.reset({
        title: existingTask.title,
        description: existingTask.description,
        category: existingTask.category || "",
        reward_amount: existingTask.reward_amount,
        time_limit_hours: existingTask.time_limit_hours,
        requires_screenshot: existingTask.requires_screenshot,
        max_completions: existingTask.max_completions || 1,
        telegram_channel_link: existingTask.telegram_channel_link || "",
        task_type: existingTask.task_type,
      });
      setSelectedCategory(existingTask.category || "");
      setChannelLink(existingTask.telegram_channel_link || "");
      if (existingTask.channel_info) {
        setChannelInfo(existingTask.channel_info);
      }
    }
  }, [existingTask, isEditMode, form]);

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress image'));
          }, 'image/jpeg', 0.85);
        };
      };
      reader.onerror = reject;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 3) {
      toast({ title: "Помилка", description: "Максимум 3 зображення", variant: "destructive" });
      return;
    }
    setSelectedImages([...selectedImages, ...files]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];
    
    setIsUploadingImages(true);
    const urls: string[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const file of selectedImages) {
        const compressedBlob = await compressImage(file);
        const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-images')
          .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('task-images')
          .getPublicUrl(fileName);

        urls.push(publicUrl);
      }
      
      return urls;
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({ title: "Помилка", description: "Не вдалося завантажити зображення", variant: "destructive" });
      return [];
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Функція для перевірки Telegram каналу
  const checkTelegramChannel = async (link: string) => {
    if (!link || link.trim().length < 2) {
      setChannelInfo(null);
      setHasAttemptedCheck(false);
      return;
    }

    // Accept: t.me links, @username, or plain username
    const isValidFormat = link.includes("t.me/") || 
                          link.startsWith("@") || 
                          (!link.includes("/") && !link.includes("http"));
    
    if (!isValidFormat) {
      setChannelInfo(null);
      setHasAttemptedCheck(false);
      return;
    }

    setIsCheckingChannel(true);
    setHasAttemptedCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-telegram-channel", {
        body: { channelLink: link },
      });

      if (error) throw error;

      if (data?.success && data?.channelInfo) {
        setChannelInfo(data.channelInfo);
        toast({ 
          title: "Успішно", 
          description: data.channelInfo.isPrivate 
            ? "Приватний канал підтверджено" 
            : "Канал знайдено!" 
        });
      } else {
        setChannelInfo(null);
        toast({ 
          title: "Помилка", 
          description: data?.error || "Не вдалося знайти канал. Перевірте посилання.", 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error("Error checking channel:", error);
      setChannelInfo(null);
      toast({ 
        title: "Помилка", 
        description: "Помилка перевірки каналу", 
        variant: "destructive" 
      });
    } finally {
      setIsCheckingChannel(false);
    }
  };

  // Дебаунс для перевірки каналу
  useEffect(() => {
    if (!channelLink || !selectedCategory?.startsWith("telegram")) {
      setChannelInfo(null);
      setHasAttemptedCheck(false);
      return;
    }
    
    // Скидаємо стан при зміні посилання
    setHasAttemptedCheck(false);
    
    const timer = setTimeout(() => {
      checkTelegramChannel(channelLink);
    }, 800); // Трохи швидше для кращого UX

    return () => clearTimeout(timer);
  }, [channelLink, selectedCategory]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    
    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance, bonus_balance")
      .eq("id", session.user.id)
      .single();
    
    // Check VIP status
    const { data: vipData } = await supabase
      .from("vip_subscriptions")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();
    
    const isVip = !!vipData;
    
    console.log("Loaded profile:", profile);
    console.log("Profile error:", profileError);
    console.log("VIP subscription:", vipData);
    console.log("Is VIP:", isVip);
    
    if (profile) {
      setUserProfile({
        ...profile,
        is_vip: isVip
      });
    }
    
    setIsLoading(false);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизовано");

      // Check balance
      const balanceToCheck = data.balance_type === "bonus" ? userProfile?.bonus_balance : userProfile?.balance;
      if (!balanceToCheck || balanceToCheck < data.reward_amount) {
        throw new Error("Недостатньо коштів на балансі");
      }

      // Upload images first
      const imageUrls = await uploadImages();

      // Validate Telegram channel if provided
      if (data.telegram_channel_link && data.category?.startsWith('telegram')) {
        const { data: validationData, error: validationError } = await supabase.functions.invoke(
          'validate-telegram-channel',
          { body: { channelLink: data.telegram_channel_link } }
        );

        if (validationError || !validationData?.success) {
          throw new Error('Неможливо підтвердити Telegram канал. Перевірте посилання.');
        }

        // Update channel info from validation
        if (validationData.channelInfo) {
          setChannelInfo(validationData.channelInfo);
        }
      }

      // Prepare channel info if available
      const channelInfoData = channelInfo ? {
        username: channelInfo.username,
        title: channelInfo.title,
        photo: channelInfo.photo,
        membersCount: channelInfo.membersCount,
        validatedAt: new Date().toISOString()
      } : null;

      // Determine task_type based on category
      // Default to 'bonus' unless explicitly VIP
      const taskType = data.category === 'vip' ? 'vip' : 'bonus';

      const taskData = {
        title: data.title,
        description: data.description,
        category: data.category,
        reward_amount: data.reward_amount,
        time_limit_hours: data.time_limit_hours,
        requires_screenshot: data.requires_screenshot,
        max_completions: data.max_completions,
        telegram_channel_link: data.telegram_channel_link || null,
        task_type: taskType,
        balance_type: data.balance_type,
        status: "pending_moderation",
        channel_info: channelInfoData,
        images: imageUrls.length > 0 ? imageUrls : null,
      };

      if (isEditMode && taskId) {
        // Update existing task
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", taskId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Create new task
        const { error } = await supabase
          .from("tasks")
          .insert({
            ...taskData,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: isEditMode ? "Завдання оновлено та відправлено на модерацію!" : "Завдання створено! Очікуйте модерацію." });
      setSelectedImages([]);
      navigate("/task-marketplace?tab=my-tasks");
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message || `Не вдалось ${isEditMode ? "оновити" : "створити"} завдання`, variant: "destructive" });
    },
  });

  const onSubmit = async (data: TaskFormData) => {
    await createTaskMutation.mutateAsync(data);
  };

  if (isLoading) {
    return <Loading />;
  }

  const categoryIcon = selectedCategory 
    ? taskCategories.find(c => c.value === selectedCategory)?.icon 
    : Briefcase;
  const CategoryIcon = categoryIcon || Briefcase;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <Card className="group relative p-6 sm:p-8 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-md border-border/50 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10">
            <Button
              variant="ghost"
              onClick={() => navigate("/task-marketplace")}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Повернутись до біржі
            </Button>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-slow flex-shrink-0">
                <Briefcase className="w-7 h-7 text-primary-foreground animate-float" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
                  {isEditMode ? "Редагувати завдання" : "Створити завдання"}
                  <Sparkles className="w-5 h-5 text-primary animate-spin-slow" />
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isEditMode 
                    ? "Відредагуйте завдання. Після збереження воно буде відправлено на повторну модерацію."
                    : "Створіть завдання для користувачів. Після модерації воно з'явиться на біржі завдань."}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="p-6 sm:p-8 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm border-border/50">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Category Selection */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                      <CategoryIcon className="w-5 h-5 text-primary" />
                      Категорія завдання
                    </FormLabel>
                    <FormControl>
                      <CategorySelector
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedCategory(value);
                          // Set task_type based on category (bonus or vip)
                          const taskType = value === 'vip' ? 'vip' : 'bonus';
                          form.setValue("task_type", taskType);
                        }}
                        categories={taskCategories}
                        placeholder="Оберіть категорію завдання"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Balance Type Selection */}
              <FormField
                control={form.control}
                name="balance_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-warning" />
                      Тип балансу для оплати
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant={field.value === "bonus" ? "default" : "outline"}
                          onClick={() => field.onChange("bonus")}
                          className="flex-1"
                        >
                          Бонусний баланс
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "main" ? "default" : "outline"}
                          onClick={() => {
                            if (userProfile?.is_vip) {
                              field.onChange("main");
                            } else {
                              toast({ 
                                title: "VIP функція", 
                                description: "Основний баланс доступний тільки для VIP користувачів",
                                variant: "destructive" 
                              });
                            }
                          }}
                          disabled={!userProfile?.is_vip}
                          className="flex-1"
                        >
                          Основний баланс {!userProfile?.is_vip && '(тільки VIP)'}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription className="flex items-center gap-1">
                      {field.value === "bonus" ? "Бонусний баланс" : "Основний баланс"}: 
                      <span className="font-semibold flex items-center gap-1">
                        {field.value === "bonus" 
                          ? <BonusBalanceDisplay amount={userProfile?.bonus_balance || 0} iconSize={14} />
                          : <BalanceDisplay amount={userProfile?.balance || 0} iconSize={14} />
                        }
                      </span>
                    </FormDescription>
                    {!userProfile?.is_vip && field.value === "main" && (
                      <p className="text-xs text-destructive mt-1">
                        Основний баланс доступний тільки для VIP користувачів
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Назва завдання</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Підпишіться на наш Telegram канал"
                        {...field}
                        className="bg-background/80"
                      />
                    </FormControl>
                    <FormDescription>Коротка та зрозуміла назва завдання</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Детальний опис</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Опишіть детально що потрібно зробити користувачу..."
                        rows={6}
                        {...field}
                        className="bg-background/80"
                      />
                    </FormControl>
                    <FormDescription>
                      Вкажіть всі важливі деталі та інструкції для виконання
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Telegram Channel Link (conditional) */}
              {selectedCategory?.startsWith("telegram") && (
                <FormField
                  control={form.control}
                  name="telegram_channel_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary" />
                        Посилання на Telegram канал
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="relative">
                            <Input
                              placeholder="t.me/канал, @username або username"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setChannelLink(e.target.value);
                              }}
                              className="bg-background/80 pr-10"
                            />
                            {isCheckingChannel && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              </div>
                            )}
                          </div>

                          {/* Channel Info Display */}
                          {channelInfo && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                {channelInfo.photo ? (
                                  <img 
                                    src={channelInfo.photo} 
                                    alt={channelInfo.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-primary">
                                    <MessageCircle className="w-6 h-6 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground truncate">
                                  {channelInfo.title}
                                </p>
                                {channelInfo.username && (
                                  <p className="text-sm text-muted-foreground">
                                    @{channelInfo.username}
                                  </p>
                                )}
                                {channelInfo.membersCount && (
                                  <p className="text-xs text-muted-foreground">
                                    {channelInfo.membersCount.toLocaleString()} підписників
                                  </p>
                                )}
                              </div>
                              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                            </div>
                          )}

                          {/* Private Channel Notice */}
                          {channelInfo?.isPrivate && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
                              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-warning font-medium">Приватний канал</p>
                                <p className="text-muted-foreground text-xs mt-1">
                                  {channelInfo.note || 'Користувачі зможуть підписатись за посиланням-запрошенням'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Error State - показуємо ТІЛЬКИ після завершення перевірки */}
                          {channelLink && hasAttemptedCheck && !isCheckingChannel && !channelInfo && channelLink.length > 3 && (
                            channelLink.includes("t.me") || 
                            channelLink.startsWith("@") || 
                            (!channelLink.includes("/") && !channelLink.includes("http"))
                          ) && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                              <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                              <span className="text-destructive">Канал не знайдено. Перевірте посилання або username.</span>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Приймається: t.me/канал (публічний), t.me/+xxx (приватний), @username або просто username
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* General Link for non-Telegram tasks */}
              {selectedCategory && !selectedCategory.startsWith("telegram") && (
                <FormField
                  control={form.control}
                  name="telegram_channel_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-primary" />
                        Посилання
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com"
                          {...field}
                          className="bg-background/80 font-mono"
                        />
                      </FormControl>
                      <FormDescription>Посилання на ресурс для виконання завдання (опціонально)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Reward and Time */}
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reward_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-warning" />
                        Винагорода (₴)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(parseFloat(value))) {
                              field.onChange(value);
                            }
                          }}
                          className="bg-background/80"
                          placeholder="0.25"
                        />
                      </FormControl>
                      <FormDescription>Винагорода від 0.25 до 10 грн</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time_limit_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Час на виконання (годин)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(parseInt(value))) {
                              field.onChange(value === '' ? '' : parseInt(value));
                            }
                          }}
                          className="bg-background/80"
                          placeholder="1"
                        />
                      </FormControl>
                      <FormDescription>Від 1 до 6 годин</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Settings */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-border/50">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  Додаткові налаштування
                </h3>

                <FormField
                  control={form.control}
                  name="requires_screenshot"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0 p-3 rounded-lg bg-background/50">
                      <div className="space-y-1">
                        <FormLabel className="text-base font-medium flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          Вимагати скріншот
                        </FormLabel>
                        <FormDescription>
                          Користувач повинен завантажити скріншот підтвердження
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_completions"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-2 p-3 rounded-lg bg-background/50">
                        <div className="space-y-1">
                          <FormLabel className="text-base font-medium flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Обмеження виконань
                          </FormLabel>
                          <FormDescription>
                            1 користувач може виконати завдання тільки 1 раз
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === 1}
                            onCheckedChange={(checked) => {
                              field.onChange(checked ? 1 : null);
                            }}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <FormLabel className="text-base font-semibold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Зображення завдання (до 3 шт.)
                </FormLabel>
                <div className="grid grid-cols-3 gap-3">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border-2 border-border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-7 w-7 p-0 rounded-full shadow-lg"
                        onClick={() => removeImage(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  {selectedImages.length < 3 && (
                    <label className="aspect-square cursor-pointer group">
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Додати фото</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Зображення будуть автоматично стиснуті до 1200x1200px (якість 85%)
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">Інформація про модерацію</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Завдання буде перевірено модератором протягом 24 годин</li>
                      <li>• Переконайтесь що опис чіткий та зрозумілий</li>
                      <li>• Винагорода буде списана з вашого балансу після схвалення</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/task-marketplace")}
                  className="flex-1"
                >
                  Скасувати
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending || isUploadingImages}
                  className="flex-1 bg-gradient-primary hover:opacity-90 transition-all duration-300"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isUploadingImages 
                    ? "Завантаження зображень..." 
                    : createTaskMutation.isPending 
                      ? (isEditMode ? "Оновлення..." : "Створення...") 
                      : (isEditMode ? "Оновити завдання" : "Створити завдання")}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default CreateTask;


