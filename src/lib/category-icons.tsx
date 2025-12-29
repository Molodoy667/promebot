import {
  Newspaper,
  Gamepad2,
  Briefcase,
  Film,
  Trophy,
  Music,
  Utensils,
  Plane,
  Laptop,
  Heart,
  BookOpen,
  Home,
  Car,
  Lightbulb,
  Smile,
  ShoppingBag,
  Camera,
  Palette,
  Dumbbell,
  Sparkles,
} from "lucide-react";

// Мапінг емодзі на іконки Lucide
export const getCategoryIcon = (emoji: string | null | undefined, className: string = "w-5 h-5") => {
  const emojiToIcon: Record<string, JSX.Element> = {
    '📰': <Newspaper className={className} />,
    '🎮': <Gamepad2 className={className} />,
    '💼': <Briefcase className={className} />,
    '🎬': <Film className={className} />,
    '⚽': <Trophy className={className} />,
    '🎵': <Music className={className} />,
    '🍔': <Utensils className={className} />,
    '✈️': <Plane className={className} />,
    '💻': <Laptop className={className} />,
    '🏥': <Heart className={className} />,
    '📚': <BookOpen className={className} />,
    '🏠': <Home className={className} />,
    '🚗': <Car className={className} />,
    '💡': <Lightbulb className={className} />,
    '😀': <Smile className={className} />,
    '🛍️': <ShoppingBag className={className} />,
    '📷': <Camera className={className} />,
    '🎨': <Palette className={className} />,
    '💪': <Dumbbell className={className} />,
    '✨': <Sparkles className={className} />,
  };

  return emoji && emojiToIcon[emoji] ? emojiToIcon[emoji] : <Sparkles className={className} />;
};

// Для відображення в тексті (наприклад в dropdown)
export const getCategoryIconInline = (emoji: string | null | undefined) => {
  return getCategoryIcon(emoji, "w-4 h-4 inline-block mr-1");
};
