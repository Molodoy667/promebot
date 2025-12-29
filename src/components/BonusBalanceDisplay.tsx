import { Coins } from "lucide-react";

interface BonusBalanceDisplayProps {
  amount: number;
  className?: string;
  showIcon?: boolean;
  iconSize?: number;
}

export const BonusBalanceDisplay = ({ 
  amount, 
  className = "", 
  showIcon = true,
  iconSize = 16 
}: BonusBalanceDisplayProps) => {
  return (
    <span className={`inline-flex items-center gap-1 text-warning ${className}`}>
      {showIcon && <Coins className={`w-${iconSize/4} h-${iconSize/4}`} style={{ width: iconSize, height: iconSize }} />}
      {amount.toFixed(2)}₴
    </span>
  );
};
