import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const results: TestResult[] = [];

  try {
    // Step 1: Create test referrer user
    results.push({ step: '1. Creating referrer user', success: false });
    const { data: authReferrer, error: authReferrerError } = await supabase.auth.admin.createUser({
      email: `referrer_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authReferrerError) throw new Error(`Referrer creation failed: ${authReferrerError.message}`);
    
    const referrerId = authReferrer.user.id;
    results[0] = { step: '1. Creating referrer user', success: true, data: { id: referrerId } };

    // Step 2: Get referrer's referral code
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for profile creation
    
    const { data: referrerProfile, error: referrerProfileError } = await supabase
      .from('profiles')
      .select('referral_code, bonus_balance')
      .eq('id', referrerId)
      .single();

    if (referrerProfileError || !referrerProfile?.referral_code) {
      throw new Error('Referrer profile not found or no referral code');
    }

    results.push({
      step: '2. Getting referrer code',
      success: true,
      data: { code: referrerProfile.referral_code, initial_balance: referrerProfile.bonus_balance }
    });

    // Step 3: Create test referee user
    results.push({ step: '3. Creating referee user', success: false });
    const { data: authReferee, error: authRefereeError } = await supabase.auth.admin.createUser({
      email: `referee_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authRefereeError) throw new Error(`Referee creation failed: ${authRefereeError.message}`);
    
    const refereeId = authReferee.user.id;
    results[2] = { step: '3. Creating referee user', success: true, data: { id: refereeId } };

    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for profile creation

    // Step 4: Apply referral code
    results.push({ step: '4. Applying referral code', success: false });
    const { data: applyResult, error: applyError } = await supabase.rpc('apply_referral_code', {
      p_referral_code: referrerProfile.referral_code,
      p_user_id: refereeId,
    });

    if (applyError) throw new Error(`Apply referral failed: ${applyError.message}`);
    
    const applyResponse = Array.isArray(applyResult) ? applyResult[0] : applyResult;
    
    if (!applyResponse.success) {
      throw new Error(`Apply referral failed: ${applyResponse.message}`);
    }

    results[3] = { step: '4. Applying referral code', success: true, data: applyResponse };

    // Step 5: Check balances after referral
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: referrerAfter, error: referrerAfterError } = await supabase
      .from('profiles')
      .select('bonus_balance')
      .eq('id', referrerId)
      .single();

    const { data: refereeAfter, error: refereeAfterError } = await supabase
      .from('profiles')
      .select('bonus_balance')
      .eq('id', refereeId)
      .single();

    if (referrerAfterError || refereeAfterError) {
      throw new Error('Failed to fetch balances after referral');
    }

    results.push({
      step: '5. Checking balances after referral',
      success: true,
      data: {
        referrer_balance: referrerAfter.bonus_balance,
        referee_balance: refereeAfter.bonus_balance,
      }
    });

    // Step 6: Check transactions
    const { data: referrerTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', referrerId)
      .eq('type', 'referral_bonus')
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: refereeTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', refereeId)
      .eq('type', 'referral_bonus')
      .order('created_at', { ascending: false })
      .limit(1);

    results.push({
      step: '6. Checking transactions',
      success: true,
      data: {
        referrer_transaction: referrerTransactions?.[0] || null,
        referee_transaction: refereeTransactions?.[0] || null,
      }
    });

    // Step 7: Get active tariff for purchase test
    const { data: tariffs, error: tariffsError } = await supabase
      .from('tariffs')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .limit(1);

    if (tariffsError || !tariffs || tariffs.length === 0) {
      throw new Error('No active tariffs found');
    }

    const testTariff = tariffs[0];
    results.push({
      step: '7. Found test tariff',
      success: true,
      data: { tariff: testTariff.name, price: testTariff.price }
    });

    // Step 8: Add balance to referee to buy tariff
    const { error: addBalanceError } = await supabase
      .from('profiles')
      .update({ balance: testTariff.price })
      .eq('id', refereeId);

    if (addBalanceError) throw new Error(`Failed to add balance: ${addBalanceError.message}`);

    results.push({
      step: '8. Added balance to referee',
      success: true,
      data: { balance: testTariff.price }
    });

    // Step 9: Create subscription (purchase tariff)
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: refereeId,
        tariff_id: testTariff.id,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (subscriptionError) throw new Error(`Failed to create subscription: ${subscriptionError.message}`);

    results.push({
      step: '9. Created subscription',
      success: true,
      data: { subscription_id: subscription.id }
    });

    // Step 10: Check referrer commission
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for trigger
    
    const { data: referrerFinal, error: referrerFinalError } = await supabase
      .from('profiles')
      .select('bonus_balance')
      .eq('id', referrerId)
      .single();

    if (referrerFinalError) throw new Error('Failed to fetch final referrer balance');

    // Get commission transaction
    const { data: commissionTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', referrerId)
      .eq('type', 'referral_commission')
      .order('created_at', { ascending: false })
      .limit(1);

    results.push({
      step: '10. Checking referral commission',
      success: true,
      data: {
        referrer_final_balance: referrerFinal.bonus_balance,
        commission_transaction: commissionTransactions?.[0] || null,
      }
    });

    // Step 11: Cleanup
    await supabase.auth.admin.deleteUser(referrerId);
    await supabase.auth.admin.deleteUser(refereeId);
    
    results.push({
      step: '11. Cleanup completed',
      success: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All tests passed!',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Test error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    results.push({
      step: 'ERROR',
      success: false,
      error: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});