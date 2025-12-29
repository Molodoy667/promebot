import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Coins, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

interface Roulette3DWrapperProps {
  userId: string;
  currentBalance: number;
  onBalanceUpdate: () => void;
  betAmount: number;
}

export function Roulette3DWrapper({ userId, currentBalance, onBalanceUpdate, betAmount }: Roulette3DWrapperProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameBalance, setGameBalance] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Listen for messages from iframe
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'roulette_bet') {
        // Bet placed - deduct from main balance
        console.log('Bet placed:', event.data.amount);
        await handleBetPlaced(event.data.amount);
      } else if (event.data.type === 'roulette_balance_update') {
        console.log('Balance update from game:', event.data.balance, 'Win:', event.data.win);
        setGameBalance(event.data.balance);
        
        // Sync main balance with game balance
        await syncBalanceWithGame(event.data.balance, event.data.win);
      } else if (event.data.type === 'roulette_recharge') {
        handleRecharge();
      } else if (event.data.type === 'roulette_request_balance') {
        // Game is requesting initial balance
        console.log('Game requesting balance, sending:', currentBalance);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'set_balance', balance: currentBalance },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [userId, currentBalance]);

  const playSound = (type: 'win' | 'lose') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (type === 'win') {
      // Happy ascending melody
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.15);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.15 + 0.4);
        
        oscillator.start(audioContext.currentTime + index * 0.15);
        oscillator.stop(audioContext.currentTime + index * 0.15 + 0.4);
      });
    } else {
      // Sad descending melody
      const notes = [523.25, 392.00, 329.63, 261.63]; // C5, G4, E4, C4
      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.2);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + index * 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.2 + 0.5);
        
        oscillator.start(audioContext.currentTime + index * 0.2);
        oscillator.stop(audioContext.currentTime + index * 0.2 + 0.5);
      });
    }
  };

  const handleBetPlaced = async (betAmount: number) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Deduct bet from main balance
      await supabase
        .from("profiles")
        .update({ bonus_balance: profile.bonus_balance - betAmount })
        .eq("id", userId);

      await supabase.from("transactions").insert({
        user_id: userId,
        amount: -betAmount,
        type: "game_bet",
        description: "Ставка в 3D Рулетці",
        status: "completed",
      });

      console.log('Bet deducted from main balance:', betAmount);
      onBalanceUpdate();

      toast({
        title: "💰 Ставку зроблено",
        description: `Списано ${betAmount} бонусів`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error processing bet:", error);
    }
  };

  const syncBalanceWithGame = async (gameBalance: number, winAmount: number) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("bonus_balance")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Calculate the difference
      const currentMainBalance = profile.bonus_balance;
      
      // If player won, add win to main balance
      if (winAmount > 0) {
        await supabase
          .from("profiles")
          .update({ bonus_balance: currentMainBalance + winAmount })
          .eq("id", userId);

        await supabase.from("transactions").insert({
          user_id: userId,
          amount: winAmount,
          type: "game_win",
          description: `Виграш в 3D Рулетці`,
          status: "completed",
        });

        playSound('win');
        
        toast({
          title: "🎉 Виграш!",
          description: `Ви виграли ${winAmount} бонусів!`,
        });

        console.log('Win added to main balance:', winAmount);
        onBalanceUpdate();
      } else if (winAmount === 0) {
        // Player lost
        playSound('lose');
        
        toast({
          title: "😔 Програш",
          description: "На жаль, цього разу не пощастило. Спробуйте ще!",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error syncing balance:", error);
    }
  };

  const handleRecharge = async () => {
    // When player runs out of money in game
    toast({
      title: "Гра завершена",
      description: "Повертаємося до меню",
      variant: "default",
    });
    
    setTimeout(() => {
      resetGame();
    }, 2000);
  };


  const startGame = async () => {
    if (currentBalance < 10) {
      toast({
        title: "Недостатньо коштів",
        description: `Потрібно мінімум 10 бонусів`,
        variant: "destructive",
      });
      return;
    }

    // Start game with current balance directly
    setGameBalance(currentBalance);
    setGameStarted(true);

    console.log('Starting game with balance:', currentBalance);

    // Send user's full balance to game multiple times to ensure it's received
    const sendBalance = () => {
      if (iframeRef.current?.contentWindow) {
        console.log('Sending balance to game:', currentBalance);
        iframeRef.current.contentWindow.postMessage(
          { type: 'set_balance', balance: currentBalance },
          '*'
        );
      }
    };

    // Send immediately and then retry
    setTimeout(sendBalance, 500);
    setTimeout(sendBalance, 1000);
    setTimeout(sendBalance, 1500);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // Enter fullscreen
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).mozRequestFullScreen) {
        (containerRef.current as any).mozRequestFullScreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const resetGame = () => {
    if (isFullscreen) {
      toggleFullscreen();
    }
    
    // Trigger parent component to close game
    window.location.reload();
  };

  // Auto-start game when component mounts
  useEffect(() => {
    if (!gameStarted && currentBalance >= 10) {
      startGame();
    }
  }, []);

  return (
    <div>
      {/* Controls - only show when not in fullscreen */}
      {!isFullscreen && (
        <div className="flex justify-between items-center mb-2">
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="sm"
            className="bg-purple-900/20 border-purple-500/50 hover:bg-purple-900/40"
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            На весь екран
          </Button>
          
          <Button
            onClick={resetGame}
            variant="outline"
            size="sm"
            className="bg-red-900/20 border-red-500/50 hover:bg-red-900/40"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Завершити гру
          </Button>
        </div>
      )}
      
      <div ref={containerRef} className={isFullscreen ? "fixed inset-0 z-50 bg-black" : ""}>
        {/* Fullscreen controls overlay */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-50 flex gap-2">
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              size="sm"
              className="bg-purple-900/80 border-purple-500/50 hover:bg-purple-900 backdrop-blur-sm"
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Згорнути
            </Button>
            
            <Button
              onClick={resetGame}
              variant="outline"
              size="sm"
              className="bg-red-900/80 border-red-500/50 hover:bg-red-900 backdrop-blur-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Завершити
            </Button>
          </div>
        )}
        
        <div className={`overflow-hidden ${isFullscreen ? "h-full" : "h-[80vh] max-h-[800px]"}`}>
          <iframe
            ref={iframeRef}
            src="/3d/game750x600/index-custom.html"
            className="w-full h-full border-0"
            frameBorder="0"
            allowFullScreen
            title="3D Roulette"
          />
        </div>
      </div>
    </div>
  );
}
