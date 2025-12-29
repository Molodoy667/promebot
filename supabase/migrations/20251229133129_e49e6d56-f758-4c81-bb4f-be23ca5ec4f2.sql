-- Drop existing check constraint and recreate with new type
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add constraint with new type ai_post_generation
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (
  type = ANY (ARRAY[
    'deposit'::text, 
    'withdrawal'::text, 
    'bonus'::text, 
    'subscription'::text, 
    'tariff_purchase'::text, 
    'referral_bonus'::text, 
    'roulette_win'::text, 
    'reward'::text, 
    'task_reward'::text, 
    'task_payment'::text, 
    'task_budget'::text, 
    'task_budget_withdrawal'::text, 
    'ai_image_generation'::text, 
    'lottery_ticket'::text, 
    'lottery_win'::text, 
    'vip_subscription'::text,
    'ai_post_generation'::text,
    'ai_chat_rental'::text,
    'expense'::text
  ])
);