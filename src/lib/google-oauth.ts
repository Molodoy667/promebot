import { supabase } from "@/integrations/supabase/client";

export const initiateGoogleAuth = async (referralCode?: string | null): Promise<void> => {
  // Store referral code in localStorage before redirect
  if (referralCode) {
    localStorage.setItem('pending_referral_code', referralCode);
  }

  // Use Supabase built-in OAuth - it handles everything
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`, // Our callback to handle referrals
      queryParams: {
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to refresh
      },
    },
  });

  if (error) {
    throw error;
  }
  
  // Supabase automatically redirects to Google and then back
};
