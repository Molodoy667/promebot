import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Tag, Calendar, Percent } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  applicable_tariffs: string[];
  is_active: boolean;
  created_at: string;
}

export const PromoCodesManagement = () => {
  const { toast } = useToast();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [selectedTariffs, setSelectedTariffs] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadPromoCodes();
    loadTariffs();
  }, []);

  const loadPromoCodes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (error) {
      console.error("Error loading promo codes:", error);
      toast({ title: "Помилка завантаження промокодів", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTariffs = async () => {
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .select("id, name")
        .eq("is_active", true);

      if (error) throw error;
      setTariffs(data || []);
    } catch (error) {
      console.error("Error loading tariffs:", error);
    }
  };

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setDiscountValue("");
    setMaxUses("");
    setValidUntil("");
    setSelectedTariffs([]);
    setIsActive(true);
    setEditingPromo(null);
  };

  const handleEdit = (promo: PromoCode) => {
    setEditingPromo(promo);
    setCode(promo.code);
    setDiscountType(promo.discount_percent ? "percent" : "amount");
    setDiscountValue(String(promo.discount_percent || promo.discount_amount || ""));
    setMaxUses(promo.max_uses ? String(promo.max_uses) : "");
    setValidUntil(promo.valid_until ? promo.valid_until.split("T")[0] : "");
    setSelectedTariffs(promo.applicable_tariffs || []);
    setIsActive(promo.is_active);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!code.trim() || !discountValue) {
      toast({ title: "Заповніть всі обов'язкові поля", variant: "destructive" });
      return;
    }

    const discount = parseFloat(discountValue);
    if (isNaN(discount) || discount <= 0) {
      toast({ title: "Введіть коректне значення знижки", variant: "destructive" });
      return;
    }

    if (discountType === "percent" && discount > 100) {
      toast({ title: "Знижка не може бути більше 100%", variant: "destructive" });
      return;
    }

    try {
      const promoData = {
        code: code.trim().toUpperCase(),
        discount_percent: discountType === "percent" ? discount : null,
        discount_amount: discountType === "amount" ? discount : null,
        max_uses: maxUses ? parseInt(maxUses) : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        applicable_tariffs: selectedTariffs.length > 0 ? selectedTariffs : [],
        is_active: isActive,
      };

      if (editingPromo) {
        const { error } = await supabase
          .from("promo_codes")
          .update(promoData)
          .eq("id", editingPromo.id);

        if (error) throw error;
        toast({ title: "✅ Промокод оновлено" });
      } else {
        const { error } = await supabase
          .from("promo_codes")
          .insert(promoData);

        if (error) throw error;
        toast({ title: "✅ Промокод створено" });
      }

      loadPromoCodes();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving promo code:", error);
      toast({ title: error.message || "Помилка збереження", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Видалити цей промокод?")) return;

    try {
      const { error } = await supabase
        .from("promo_codes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "✅ Промокод видалено" });
      loadPromoCodes();
    } catch (error) {
      console.error("Error deleting promo code:", error);
      toast({ title: "Помилка видалення", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("promo_codes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast({ title: `✅ Промокод ${!currentStatus ? "активовано" : "деактивовано"}` });
      loadPromoCodes();
    } catch (error) {
      console.error("Error toggling promo code:", error);
      toast({ title: "Помилка оновлення", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Промокоди
            </CardTitle>
            <CardDescription>Керування промокодами для знижок на тарифи</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Створити промокод
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPromo ? "Редагувати промокод" : "Створити промокод"}</DialogTitle>
                <DialogDescription>Заповніть дані для промокоду</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Код промокоду *</Label>
                  <Input
                    placeholder="SUMMER2025"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Тип знижки</Label>
                    <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Відсоток (%)</SelectItem>
                        <SelectItem value="amount">Сума (₴)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Значення знижки *</Label>
                    <Input
                      type="number"
                      placeholder={discountType === "percent" ? "20" : "100"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      min="0"
                      max={discountType === "percent" ? "100" : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Макс. використань</Label>
                    <Input
                      type="number"
                      placeholder="Необмежено"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Дійсний до</Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Застосовується до тарифів (порожньо = всі)</Label>
                  <Select
                    value={selectedTariffs[0] || ""}
                    onValueChange={(v) => {
                      if (v && !selectedTariffs.includes(v)) {
                        setSelectedTariffs([...selectedTariffs, v]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Оберіть тариф" />
                    </SelectTrigger>
                    <SelectContent>
                      {tariffs.map((tariff) => (
                        <SelectItem key={tariff.id} value={tariff.id}>
                          {tariff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTariffs.map((tariffId) => {
                      const tariff = tariffs.find((t) => t.id === tariffId);
                      return (
                        <Badge key={tariffId} variant="secondary" className="cursor-pointer" onClick={() => setSelectedTariffs(selectedTariffs.filter((t) => t !== tariffId))}>
                          {tariff?.name} ×
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Активний</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingPromo ? "Оновити" : "Створити"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Скасувати
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Завантаження...</p>
        ) : promoCodes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Промокодів ще немає</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Знижка</TableHead>
                <TableHead>Використано</TableHead>
                <TableHead>Дійсний до</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-mono font-semibold">{promo.code}</TableCell>
                  <TableCell>
                    {promo.discount_percent ? (
                      <Badge variant="outline" className="gap-1">
                        <Percent className="w-3 h-3" />
                        {promo.discount_percent}%
                      </Badge>
                    ) : (
                      <Badge variant="outline">{promo.discount_amount} ₴</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {promo.current_uses}
                    {promo.max_uses ? ` / ${promo.max_uses}` : " / ∞"}
                  </TableCell>
                  <TableCell>
                    {promo.valid_until ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {new Date(promo.valid_until).toLocaleDateString("uk-UA")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Без обмежень</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => handleToggleActive(promo.id, promo.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(promo)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(promo.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
