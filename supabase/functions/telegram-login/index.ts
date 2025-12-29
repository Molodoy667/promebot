import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramLoginData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

async function verifyTelegramAuth(data: TelegramLoginData, botToken: string): Promise<boolean> {
  const { hash, ...authData } = data;
  
  // Create data check string
  const dataCheckArr = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');
  
  // Create secret key using SHA-256
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(botToken);
  const secretKeyBuffer = await crypto.subtle.digest('SHA-256', tokenData);
  
  // Create HMAC using the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const dataBuffer = encoder.encode(dataCheckArr);
  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);
  
  // Convert signature to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Verify hash
  return hashHex === hash;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestBody = await req.json();
    const telegramData: TelegramLoginData = requestBody.telegram_data;
    const referralCode: string | null = requestBody.referral_code;
    
    console.log('Telegram login attempt:', { id: telegramData.id, username: telegramData.username, referralCode });

    // Get bot token from settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'telegram_login_widget')
      .single();

    if (settingsError || !settingsData) {
      console.error('Settings error:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Telegram Login Widget not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settings = settingsData.value as any;
    
    if (!settings.enabled) {
      return new Response(
        JSON.stringify({ error: 'Telegram Login Widget disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Telegram data authenticity
    const isValid = await verifyTelegramAuth(telegramData, settings.bot_token);
    
    if (!isValid) {
      console.error('Invalid Telegram authentication data');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication data' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists by telegram_id
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('telegram_id', telegramData.id)
      .single();

    let userId: string;
    let email: string;
    let isNewUser = false;

    if (existingProfile) {
      // User exists - sign them in using admin generateLink
      userId = existingProfile.id;
      email = existingProfile.email;
      console.log('Existing user found:', userId);
      
      // Use signInWithPassword with service role to get tokens
      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify`
        }
      });

      if (signInError || !signInData) {
        console.error('Failed to generate auth link:', signInError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract hashed token from properties
      const hashedToken = signInData.properties.hashed_token;
      
      // Verify the token and get session
      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'magiclink'
      });

      if (sessionError || !sessionData.session) {
        console.error('Failed to verify token:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Session created successfully for existing user');

      // Return tokens
      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          is_new_user: false,
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // Create new user
      const generatedEmail = `tg${telegramData.id}@telegram.user`;
      // Use random UUID for password - secure and unpredictable
      const password = crypto.randomUUID();
      
      console.log('Creating new user with email:', generatedEmail);

      // Handle referral code
      let referrerId: string | null = null;
      if (referralCode) {
        console.log('Processing referral code:', referralCode);
        const { data: referrerData } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode)
          .single();
        
        if (referrerData) {
          referrerId = referrerData.id;
          console.log('Found referrer:', referrerId);
        }
      }

      // Create auth user with referral info
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: generatedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`,
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          telegram_photo_url: telegramData.photo_url,
          auth_provider: 'telegram',
          referral_code: referralCode || undefined
        }
      });

      if (authError) {
        console.error('Auth user creation error:', authError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      email = generatedEmail;
      isNewUser = true;
      
      console.log('New user created:', userId);

      // Update profile with Telegram data and referral
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          telegram_id: telegramData.id,
          telegram_username: telegramData.username,
          telegram_photo_url: telegramData.photo_url,
          auth_provider: 'telegram',
          full_name: `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`,
          referred_by: referrerId,
          bonus_balance: referrerId ? 5.00 : 0.00
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
      }

      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'user'
        });

      if (roleError) {
        console.error('Role creation error:', roleError);
      }

      // If there's a referrer, create referral record and bonuses
      if (referrerId) {
        console.log('Creating referral record and bonuses...');
        
        // Create referral record
        const { error: refError } = await supabase
          .from('referrals')
          .insert({
            referrer_id: referrerId,
            referred_id: userId,
            bonus_amount: 5.00
          });

        if (refError) {
          console.error('Referral creation error:', refError);
        }

        // Add bonus to referrer
        const { error: bonusError } = await supabase
          .from('profiles')
          .update({
            bonus_balance: supabase.rpc('increment', { amount: 5.00 })
          })
          .eq('id', referrerId);

        if (!bonusError) {
          // Create transaction for referrer
          await supabase.from('transactions').insert({
            user_id: referrerId,
            type: 'referral_bonus',
            amount: 5.00,
            status: 'completed',
            description: 'Бонус за запрошення друга',
            metadata: { referred_user_id: userId, bonus_type: 'signup' }
          });

          // Create transaction for new user
          await supabase.from('transactions').insert({
            user_id: userId,
            type: 'referral_bonus',
            amount: 5.00,
            status: 'completed',
            description: 'Бонус за реєстрацію за реферальним посиланням',
            metadata: { referrer_id: referrerId, bonus_type: 'signup' }
          });
        }
      }
    }

    // Generate session tokens for new user using admin generateLink
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify`
      }
    });

    if (linkError || !linkData) {
      console.error('Failed to generate auth link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract hashed token from properties
    const hashedToken = linkData.properties.hashed_token;
    
    // Verify the token and get session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink'
    });

    if (sessionError || !sessionData.session) {
      console.error('Failed to verify token:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session created successfully for user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_new_user: isNewUser,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Telegram login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
