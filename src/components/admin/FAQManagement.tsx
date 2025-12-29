import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Trash2, GripVertical, HelpCircle } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  question_en: string | null;
  answer: string;
  answer_en: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export const FAQManagement = () => {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    question_en: "",
    answer: "",
    answer_en: "",
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const { data, error } = await supabase
        .from("faq")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error: any) {
      console.error("Error loading FAQs:", error);
      toast({
        title: "Помилка",
        description: "Не вдалось завантажити FAQ",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (faq?: FAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        question: faq.question,
        question_en: faq.question_en || "",
        answer: faq.answer,
        answer_en: faq.answer_en || "",
        display_order: faq.display_order,
        is_active: faq.is_active,
      });
    } else {
      setEditingFaq(null);
      setFormData({
        question: "",
        question_en: "",
        answer: "",
        answer_en: "",
        display_order: faqs.length,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast({
        title: "Помилка",
        description: "Заповніть обов'язкові поля",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingFaq) {
        const { error } = await supabase
          .from("faq")
          .update({
            question: formData.question,
            question_en: formData.question_en || null,
            answer: formData.answer,
            answer_en: formData.answer_en || null,
            display_order: formData.display_order,
            is_active: formData.is_active,
          })
          .eq("id", editingFaq.id);

        if (error) throw error;
        toast({
          title: "Успішно",
          description: "FAQ оновлено",
        });
      } else {
        const { error } = await supabase.from("faq").insert({
          question: formData.question,
          question_en: formData.question_en || null,
          answer: formData.answer,
          answer_en: formData.answer_en || null,
          display_order: formData.display_order,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast({
          title: "Успішно",
          description: "FAQ додано",
        });
      }

      setIsDialogOpen(false);
      loadFAQs();
    } catch (error: any) {
      console.error("Error saving FAQ:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("faq").delete().eq("id", id);

      if (error) throw error;
      toast({
        title: "Успішно",
        description: "FAQ видалено",
      });
      loadFAQs();
    } catch (error: any) {
      console.error("Error deleting FAQ:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("faq")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      loadFAQs();
    } catch (error: any) {
      console.error("Error toggling FAQ:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">FAQ</h2>
          <p className="text-sm text-muted-foreground">
            Керування питаннями та відповідями
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Додати FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFaq ? "Редагувати FAQ" : "Додати FAQ"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="question">Питання (UA) *</Label>
                <Input
                  id="question"
                  value={formData.question}
                  onChange={(e) =>
                    setFormData({ ...formData, question: e.target.value })
                  }
                  placeholder="Введіть питання українською"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="question_en">Питання (EN)</Label>
                <Input
                  id="question_en"
                  value={formData.question_en}
                  onChange={(e) =>
                    setFormData({ ...formData, question_en: e.target.value })
                  }
                  placeholder="Enter question in English"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Відповідь (UA) *</Label>
                <Textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  placeholder="Введіть відповідь українською"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer_en">Відповідь (EN)</Label>
                <Textarea
                  id="answer_en"
                  value={formData.answer_en}
                  onChange={(e) =>
                    setFormData({ ...formData, answer_en: e.target.value })
                  }
                  placeholder="Enter answer in English"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_order">Порядок відображення</Label>
                  <Input
                    id="display_order"
                    type="text"
                    value={formData.display_order}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || !isNaN(parseInt(value))) {
                        setFormData({
                          ...formData,
                          display_order: parseInt(value) || 0,
                        });
                      }
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">Активний</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Скасувати
                </Button>
                <Button onClick={handleSave}>
                  {editingFaq ? "Зберегти" : "Додати"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {faqs.length === 0 ? (
        <Card className="p-8 text-center">
          <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">FAQ поки немає</p>
          <Button className="mt-4" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Додати перше питання
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <Card
              key={faq.id}
              className={`p-4 ${!faq.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm mb-1 truncate">
                    {faq.question}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {faq.answer}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={faq.is_active}
                    onCheckedChange={(checked) =>
                      handleToggleActive(faq.id, checked)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(faq)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Видалити FAQ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ця дія незворотна. FAQ буде видалено назавжди.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Скасувати</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(faq.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Видалити
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
