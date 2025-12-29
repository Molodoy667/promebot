import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MinerBot {
  level: number;
  owned: number;
}

interface MinerData {
  user_id: string;
  total_earned: number;
  miners_owned: Record<string, MinerBot>;
  last_claim: string;
  auto_collect_enabled: boolean;
  auto_collect_level: number;
  last_auto_collect: string;
}

// Bot configurations matching frontend
const MINER_BOTS = [
  { id: "basic_miner", earnings_per_hour: 10 },
  { id: "turbo_miner", earnings_per_hour: 60 },
  { id: "mega_miner", earnings_per_hour: 250 },
  { id: "quantum_miner", earnings_per_hour: 1200 },
  { id: "ai_miner", earnings_per_hour: 6000 },
  { id: "cosmic_miner", earnings_per_hour: 30000 }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting auto-collect for all eligible users...');

    // Get all users with auto-collect enabled
    const { data: users, error: usersError } = await supabaseClient
      .from('miner_game_data')
      .select('*')
      .eq('auto_collect_enabled', true);

    if (usersError) {
      throw usersError;
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users with auto-collect enabled', collected: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let collectedCount = 0;
    const results = [];

    for (const userData of users as MinerData[]) {
      try {
        // Determine interval based on level
        const intervalMinutes = [5, 3, 1, 0.5][userData.auto_collect_level - 1] || 5;
        
        const lastAutoCollect = userData.last_auto_collect 
          ? new Date(userData.last_auto_collect).getTime()
          : new Date(userData.last_claim).getTime();
        
        const now = Date.now();
        const minutesPassed = (now - lastAutoCollect) / (1000 * 60);

        // Check if enough time has passed
        if (minutesPassed < intervalMinutes) {
          continue;
        }

        // Calculate earnings
        const lastClaim = new Date(userData.last_claim).getTime();
        const hoursPassed = (now - lastClaim) / (1000 * 60 * 60);
        
        // Max 72 hours cap
        const cappedHours = Math.min(hoursPassed, 72);
        
        // Calculate total earnings per hour
        let totalEarningsPerHour = 0;
        for (const [botId, botData] of Object.entries(userData.miners_owned)) {
          const botConfig = MINER_BOTS.find(b => b.id === botId);
          if (botConfig) {
            // Apply level multiplier: earnings * 1.15^(level-1)
            const earnings = Math.floor(
              botConfig.earnings_per_hour * Math.pow(1.15, botData.level - 1)
            );
            totalEarningsPerHour += earnings * botData.owned;
          }
        }

        const earnings = Math.floor(totalEarningsPerHour * cappedHours);

        if (earnings === 0) {
          continue;
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('bonus_balance')
          .eq('id', userData.user_id)
          .single();

        if (profileError || !profile) {
          console.error(`Failed to get profile for user ${userData.user_id}:`, profileError);
          continue;
        }

        const newBalance = profile.bonus_balance + earnings;
        const newTotalEarned = userData.total_earned + earnings;

        // Update profile bonus_balance
        const { error: updateProfileError } = await supabaseClient
          .from('profiles')
          .update({ bonus_balance: newBalance })
          .eq('id', userData.user_id);

        if (updateProfileError) {
          console.error(`Failed to update profile for user ${userData.user_id}:`, updateProfileError);
          continue;
        }

        // Update game data
        const { error: updateGameError } = await supabaseClient
          .from('miner_game_data')
          .update({
            total_earned: newTotalEarned,
            last_claim: new Date().toISOString(),
            last_auto_collect: new Date().toISOString()
          })
          .eq('user_id', userData.user_id);

        if (updateGameError) {
          console.error(`Failed to update game data for user ${userData.user_id}:`, updateGameError);
          continue;
        }

        collectedCount++;
        results.push({
          user_id: userData.user_id,
          earnings,
          new_balance: newBalance,
          new_total_earned: newTotalEarned
        });

        console.log(`Auto-collected ${earnings} for user ${userData.user_id}`);

      } catch (userError) {
        console.error(`Error processing user ${userData.user_id}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        collected: collectedCount,
        total_users: users.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in miner-auto-collect:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
