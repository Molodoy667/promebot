import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  show_in_footer: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const StaticPagesManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    content: "",
    is_active: true,
    show_in_footer: false,
    display_order: 0,
  });

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["static-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("static_pages")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as StaticPage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("static_pages").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["static-pages"] });
      toast({ title: "Сторінку створено" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("static_pages")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["static-pages"] });
      toast({ title: "Сторінку оновлено" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("static_pages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["static-pages"] });
      toast({ title: "Сторінку видалено" });
      setDeletePageId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (page?: StaticPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        slug: page.slug,
        title: page.title,
        content: page.content,
        is_active: page.is_active,
        show_in_footer: page.show_in_footer,
        display_order: page.display_order,
      });
    } else {
      setEditingPage(null);
      setFormData({
        slug: "",
        title: "",
        content: "",
        is_active: true,
        show_in_footer: false,
        display_order: pages.length,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPage(null);
    setFormData({
      slug: "",
      title: "",
      content: "",
      is_active: true,
      show_in_footer: false,
      display_order: 0,
    });
  };

  const handleSubmit = () => {
    if (!formData.slug || !formData.title || !formData.content) {
      toast({
        title: "Помилка",
        description: "Заповніть всі обов'язкові поля",
        variant: "destructive",
      });
      return;
    }

    if (editingPage) {
      updateMutation.mutate({ id: editingPage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div>Завантаження...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Статичні сторінки</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Додати сторінку
        </Button>
      </div>

      <div className="grid gap-4">
        {pages.map((page) => (
          <Card key={page.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{page.title}</h3>
                  {!page.is_active && (
                    <span className="text-xs px-2 py-1 bg-muted rounded">Неактивна</span>
                  )}
                  {page.show_in_footer && (
                    <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                      В футері
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">Slug: {page.slug}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{page.content}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(`/page/${page.slug}`, "_blank")}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDialog(page)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletePageId(page.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPage ? "Редагувати сторінку" : "Створити сторінку"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="slug">Slug (URL)*</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
                placeholder="about-us"
                disabled={!!editingPage}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Латинські букви, цифри та дефіси. Використовується в URL.
              </p>
            </div>

            <div>
              <Label htmlFor="title">Заголовок*</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Про нас"
              />
            </div>

            <div>
              <Label htmlFor="content">Вміст*</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Текст сторінки..."
                rows={10}
              />
            </div>

            <div>
              <Label htmlFor="display_order">Порядок відображення</Label>
              <Input
                id="display_order"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={formData.display_order.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setFormData({ ...formData, display_order: value === '' ? 0 : parseInt(value) });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Активна</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show_in_footer">Показувати в футері</Label>
              <Switch
                id="show_in_footer"
                checked={formData.show_in_footer}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, show_in_footer: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Скасувати
            </Button>
            <Button onClick={handleSubmit}>
              {editingPage ? "Зберегти" : "Створити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePageId} onOpenChange={() => setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити сторінку?</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо скасувати. Сторінка буде видалена назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePageId && deleteMutation.mutate(deletePageId)}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
