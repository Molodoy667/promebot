-- Add new notification types for tariff and VIP expiration
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'system',
  'ticket_reply',
  'account_login',
  'task_approved',
  'task_rejected',
  'lottery_win',
  'tariff_expired',
  'vip_expired',
  'vip_purchase',
  'tariff_purchase'
));
