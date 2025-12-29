import { Bot } from "lucide-react";

interface LoadingProps {
  message?: string;
}

export const Loading = ({ message = "Завантаження..." }: LoadingProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-50">
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow animate-pulse">
          <Bot className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};
