const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  'https://vtrkcgaajgtlkjqcnwxk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const sql = `
-- Update storage upgrade function to use settings from app_settings
CREATE OR REPLACE FUNCTION upgrade_miner_storage()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_game_data RECORD;
  v_profile RECORD;
  v_new_level INTEGER;
  v_upgrade_cost NUMERIC;
  v_new_max_hours NUMERIC;
  v_miner_config JSONB;
  v_storage_base_hours INTEGER;
  v_storage_hours_per_level INTEGER;
  v_storage_base_cost INTEGER;
  v_storage_cost_multiplier NUMERIC;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get miner config from app_settings
  SELECT value INTO v_miner_config 
  FROM public.app_settings 
  WHERE key = 'miner_config';
  
  -- Extract storage settings with defaults
  v_storage_base_hours := COALESCE((v_miner_config->>'storage_base_hours')::INTEGER, 6);
  v_storage_hours_per_level := COALESCE((v_miner_config->>'storage_hours_per_level')::INTEGER, 2);
  v_storage_base_cost := COALESCE((v_miner_config->>'storage_base_cost')::INTEGER, 100);
  v_storage_cost_multiplier := COALESCE((v_miner_config->>'storage_cost_multiplier')::NUMERIC, 1.5);

  -- Get current game data
  SELECT * INTO v_game_data FROM public.miner_game_data WHERE user_id = v_user_id;
  
  IF v_game_data IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Miner game data not found');
  END IF;

  -- Calculate new level
  v_new_level := COALESCE(v_game_data.storage_level, 1) + 1;
  
  -- Cost formula: base_cost * (multiplier ^ (level - 2))
  v_upgrade_cost := v_storage_base_cost * POWER(v_storage_cost_multiplier, v_new_level - 2);
  
  -- Max hours formula: base_hours + (level - 1) * hours_per_level
  v_new_max_hours := v_storage_base_hours + (v_new_level - 1) * v_storage_hours_per_level;

  -- Get user profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  
  IF v_profile.bonus_balance < v_upgrade_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct cost
  UPDATE public.profiles
  SET bonus_balance = bonus_balance - v_upgrade_cost
  WHERE id = v_user_id;

  -- Upgrade storage
  UPDATE public.miner_game_data
  SET 
    storage_level = v_new_level,
    storage_max_hours = v_new_max_hours
  WHERE user_id = v_user_id;

  -- Create transaction
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (v_user_id, -v_upgrade_cost, 'task_payment', 
          'Покращення сховища до рівня ' || v_new_level, 'completed');

  RETURN json_build_object(
    'success', true,
    'new_level', v_new_level,
    'new_max_hours', v_new_max_hours,
    'cost', v_upgrade_cost,
    'new_balance', (SELECT bonus_balance FROM public.profiles WHERE id = v_user_id)
  );
END;
$$;
`;

(async () => {
  try {
    console.log('🔧 Updating storage upgrade function...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
    
    console.log('✅ Storage upgrade function updated!');
    console.log('📊 Result:', data);
    console.log('\n✨ Now uses settings from miner_config in app_settings');
  } catch (err) {
    console.error('❌ Exception:', err);
    process.exit(1);
  }
})();
