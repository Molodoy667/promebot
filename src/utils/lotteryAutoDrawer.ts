/**
 * Auto Lottery Drawer
 * Automatically triggers lottery draws when time is up
 */

import { supabase } from "@/integrations/supabase/client";

let drawInterval: NodeJS.Timeout | null = null;

export const startLotteryAutoDrawer = () => {
  console.log('🎰 Starting lottery auto-drawer...');
  
  // Check every 30 seconds
  drawInterval = setInterval(async () => {
    try {
      await checkAndDrawLottery();
    } catch (error) {
      console.error('Error in lottery auto-drawer:', error);
    }
  }, 30000); // 30 seconds
  
  // Also run immediately
  checkAndDrawLottery();
};

export const stopLotteryAutoDrawer = () => {
  if (drawInterval) {
    clearInterval(drawInterval);
    drawInterval = null;
    console.log('🎰 Stopped lottery auto-drawer');
  }
};

async function checkAndDrawLottery() {
  try {
    // Get settings
    const { data: settings } = await supabase
      .from("lottery_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings || !settings.is_enabled) {
      return;
    }

    // Get active round
    const { data: activeRound } = await supabase
      .from("lottery_rounds")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeRound) {
      return;
    }

    // Check if it's time to draw
    const startTime = new Date(activeRound.start_time).getTime();
    const now = Date.now();
    const drawInterval = settings.draw_interval_hours * 60 * 60 * 1000;
    const elapsed = now - startTime;

    if (elapsed >= drawInterval) {
      console.log('🎉 Time to draw lottery! Round:', activeRound.id);
      
      // Call the draw function
      const { data, error } = await supabase.rpc("draw_lottery_winner", {
        p_round_id: activeRound.id,
      });

      if (error) {
        console.error('Error drawing lottery:', error);
        return;
      }

      const result = data as { success: boolean; error?: string; winner_id?: string; prize?: number };

      if (result.success) {
        console.log('✅ Lottery drawn successfully!', result);
        
        // Show notification if possible
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🎉 Лотерея розіграна!', {
            body: `Переможець отримав ${result.prize?.toFixed(2)}₴`,
            icon: '/favicon.ico'
          });
        }
      } else {
        console.error('Failed to draw lottery:', result.error);
      }
    }
  } catch (error) {
    console.error('Error checking lottery:', error);
  }
}
