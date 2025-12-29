import { useState } from "react";
import { Check, ChevronDown, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";

export interface CategoryOption {
  value: string;
  label: string;
  emoji?: string;
  icon?: LucideIcon;
  description?: string;
}

interface CategorySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: CategoryOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelector({
  value,
  onValueChange,
  categories,
  placeholder = "Виберіть категорію",
  disabled = false,
}: CategorySelectorProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const selectedCategory = categories.find((cat) => cat.value === value);

  const handleSelect = (categoryValue: string) => {
    onValueChange(categoryValue);
    setOpen(false);
  };

  const CategoryButton = ({ category }: { category: CategoryOption }) => {
    const Icon = category.icon;
    
    return (
      <button
        type="button"
        onClick={() => handleSelect(category.value)}
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all text-left",
          "hover:border-primary/50 hover:bg-accent/30 active:scale-[0.98]",
          value === category.value
            ? "border-primary glass-card shadow-glow"
            : "border-border/30 glass-effect"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getCategoryIcon(category.emoji, "w-6 h-6 shrink-0")}
          {Icon && <Icon className="w-6 h-6 shrink-0 text-primary" />}
          <div className="flex-1 min-w-0">
            <div className="font-medium">{category.label}</div>
            {category.description && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {category.description}
              </div>
            )}
          </div>
        </div>
        {value === category.value && (
          <Check className="w-5 h-5 shrink-0 text-primary ml-2" />
        )}
      </button>
    );
  };

  const SelectedIcon = selectedCategory?.icon;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="w-full justify-between h-auto py-3 px-4"
          >
            <div className="flex items-center gap-2">
              {selectedCategory?.emoji && (
                <span className="text-xl">{selectedCategory.emoji}</span>
              )}
              {SelectedIcon && <SelectedIcon className="w-5 h-5" />}
              <span className={cn(!selectedCategory && "text-muted-foreground")}>
                {selectedCategory?.label || placeholder}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Оберіть категорію</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="h-[60vh] px-4 pb-6">
            <div className="space-y-2">
              {categories.map((category) => (
                <CategoryButton key={category.value} category={category} />
              ))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between h-auto py-3 px-4"
        >
          <div className="flex items-center gap-2">
            {selectedCategory?.emoji && (
              <span className="text-xl">{selectedCategory.emoji}</span>
            )}
            {SelectedIcon && <SelectedIcon className="w-5 h-5" />}
            <span className={cn(!selectedCategory && "text-muted-foreground")}>
              {selectedCategory?.label || placeholder}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[400px]" align="start">
        <ScrollArea className="max-h-[400px]">
          <div className="p-2 space-y-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => handleSelect(category.value)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-md transition-colors text-left",
                    "hover:bg-accent",
                    value === category.value && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getCategoryIcon(category.emoji, "w-5 h-5 shrink-0")}
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{category.label}</div>
                      {category.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {category.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {value === category.value && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
