import { CreditCard } from "lucide-react";

interface BalanceDisplayProps {
  amount: number;
  className?: string;
  showIcon?: boolean;
  iconSize?: number;
}

export const BalanceDisplay = ({ 
  amount, 
  className = "", 
  showIcon = true,
  iconSize = 16 
}: BalanceDisplayProps) => {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && <CreditCard className={`w-${iconSize/4} h-${iconSize/4}`} style={{ width: iconSize, height: iconSize }} />}
      {amount.toFixed(2)}₴
    </span>
  );
};
