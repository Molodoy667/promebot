import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export function SwipeHint() {
  const [show, setShow] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check if user has seen the hint before
    const hasSeenHint = localStorage.getItem("swipe-hint-seen");
    
    if (hasSeenHint) {
      setShow(false);
      return;
    }

    // Hide hint after 8 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        setShow(false);
        localStorage.setItem("swipe-hint-seen", "true");
      }, 500);
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div 
      className={`fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-1">
        <div className="w-1 h-16 bg-primary rounded-r-full animate-swipe-hint shadow-glow" />
        <ChevronRight className="w-8 h-8 text-primary animate-bounce-horizontal drop-shadow-lg" />
      </div>
    </div>
  );
}
