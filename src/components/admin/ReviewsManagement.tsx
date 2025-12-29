import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Check, X, Trash2, Star, MessageSquare, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  text: string;
  is_approved: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export const ReviewsManagement = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          profiles!reviews_user_id_fkey (
            full_name,
            email,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error: any) {
      console.error("Error loading reviews:", error);
      toast({
        title: "Помилка",
        description: "Не вдалось завантажити відгуки",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ is_approved: true })
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Успішно",
        description: "Відгук схвалено",
      });
      loadReviews();
    } catch (error: any) {
      console.error("Error approving review:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ is_approved: false })
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Успішно",
        description: "Відгук відхилено",
      });
      loadReviews();
    } catch (error: any) {
      console.error("Error rejecting review:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", id);

      if (error) throw error;
      toast({
        title: "Успішно",
        description: "Відгук видалено",
      });
      loadReviews();
    } catch (error: any) {
      console.error("Error deleting review:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderStars = (count: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= count ? "fill-warning text-warning" : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "pending") return !review.is_approved;
    if (filter === "approved") return review.is_approved;
    return true;
  });

  const pendingCount = reviews.filter((r) => !r.is_approved).length;
  const approvedCount = reviews.filter((r) => r.is_approved).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Відгуки</h2>
          <p className="text-sm text-muted-foreground">
            Модерація відгуків користувачів
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            <Clock className="w-4 h-4 mr-1" />
            Очікують ({pendingCount})
          </Button>
          <Button
            variant={filter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("approved")}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Схвалені ({approvedCount})
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Всі ({reviews.length})
          </Button>
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {filter === "pending"
              ? "Немає відгуків на модерації"
              : filter === "approved"
              ? "Немає схвалених відгуків"
              : "Відгуків поки немає"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={review.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {review.profiles?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {review.profiles?.full_name || "Користувач"}
                      </span>
                      <Badge variant={review.is_approved ? "default" : "secondary"}>
                        {review.is_approved ? "Схвалено" : "На модерації"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(review.created_at), "d MMM yyyy, HH:mm", { locale: uk })}
                    </span>
                  </div>
                  {review.profiles?.email && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {review.profiles.email}
                    </p>
                  )}
                  <div className="mb-2">{renderStars(review.rating)}</div>
                  <p className="text-sm">{review.text}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!review.is_approved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleApprove(review.id)}
                      className="text-success hover:text-success hover:bg-success/10"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  {review.is_approved && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReject(review.id)}
                      className="text-warning hover:text-warning hover:bg-warning/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Видалити відгук?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ця дія незворотна. Відгук буде видалено назавжди.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Скасувати</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(review.id)}
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
