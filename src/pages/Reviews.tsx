import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { Star, Send, MessageSquare, Clock, CheckCircle } from "lucide-react";
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
    avatar_url: string | null;
  };
}

const Reviews = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadReviews();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadMyReviews(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      loadMyReviews(session.user.id);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          profiles!reviews_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyReviews = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyReviews(data || []);
    } catch (error) {
      console.error("Error loading my reviews:", error);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Потрібна авторизація",
        description: "Увійдіть в акаунт, щоб залишити відгук",
        variant: "destructive",
      });
      return;
    }

    // Check if user already has a review
    if (myReviews.length > 0) {
      toast({
        title: "Помилка",
        description: "Ви вже залишили відгук",
        variant: "destructive",
      });
      return;
    }

    if (!text.trim()) {
      toast({
        title: "Помилка",
        description: "Введіть текст відгуку",
        variant: "destructive",
      });
      return;
    }

    if (text.trim().length < 10) {
      toast({
        title: "Помилка",
        description: "Відгук занадто короткий (мінімум 10 символів)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        user_id: user.id,
        rating,
        text: text.trim(),
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ви вже залишили відгук");
        }
        throw error;
      }

      toast({
        title: "Успішно",
        description: "Ваш відгук відправлено на модерацію",
      });

      setText("");
      setRating(5);
      loadMyReviews(user.id);
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (count: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
          >
            <Star
              className={`w-5 h-5 ${
                star <= (interactive ? (hoverRating || rating) : count)
                  ? "fill-warning text-warning"
                  : "text-muted-foreground"
              } transition-colors`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <Loading />;
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        <PageHeader
          icon={Star}
          title="Відгуки"
          description="Дізнайтеся, що кажуть наші користувачі про сервіс та залиште свій відгук"
        />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 glass-effect text-center">
          <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{averageRating}</div>
          <div className="flex justify-center mb-1">{renderStars(Math.round(Number(averageRating)))}</div>
          <p className="text-xs text-muted-foreground">Середня оцінка</p>
        </Card>
        <Card className="p-4 glass-effect text-center">
          <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{reviews.length}</div>
          <p className="text-xs text-muted-foreground">Відгуків</p>
        </Card>
        {user && (
          <Card className="p-4 glass-effect text-center col-span-2 sm:col-span-1">
            <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{myReviews.length}</div>
            <p className="text-xs text-muted-foreground">Ваших відгуків</p>
          </Card>
        )}
      </div>

      {/* Review Form */}
      {user ? (
        myReviews.length > 0 ? (
          <Card className="p-4 sm:p-6 glass-effect mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Дякуємо за ваш відгук!</h2>
                <p className="text-sm text-muted-foreground">
                  Ви вже залишили відгук. Кожен користувач може залишити лише один відгук.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 sm:p-6 glass-effect mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Залишити відгук
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Ваша оцінка</label>
                {renderStars(rating, true)}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Текст відгуку</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Поділіться вашим досвідом використання сервісу..."
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {text.length}/1000
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Відправка..." : "Відправити"}
              </Button>
            </div>
          </Card>
        )
      ) : (
        <Card className="p-6 glass-effect mb-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Увійдіть в акаунт, щоб залишити відгук
          </p>
          <Button onClick={() => window.location.href = "/auth"}>
            Увійти
          </Button>
        </Card>
      )}

      {/* My Pending Reviews */}
      {user && myReviews.filter(r => !r.is_approved).length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            На модерації
          </h2>
          <div className="space-y-4">
            {myReviews.filter(r => !r.is_approved).map((review) => (
              <Card key={review.id} className="p-4 border-warning/30 bg-warning/5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {renderStars(review.rating)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), "d MMM yyyy", { locale: uk })}
                      </span>
                    </div>
                    <p className="text-sm">{review.text}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approved Reviews */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success" />
          Відгуки користувачів
        </h2>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="p-8 text-center glass-effect">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Поки немає відгуків</p>
            {user && (
              <p className="text-sm text-muted-foreground mt-2">
                Будьте першим, хто залишить відгук!
              </p>
            )}
          </Card>
        ) : (
          <div className="grid gap-4">
            {reviews.map((review) => (
              <Card key={review.id} className="p-4 glass-effect">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={review.profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {review.profiles?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {review.profiles?.full_name || "Користувач"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), "d MMM yyyy", { locale: uk })}
                      </span>
                    </div>
                    <div className="mb-2">{renderStars(review.rating)}</div>
                    <p className="text-sm text-muted-foreground">{review.text}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Reviews;
