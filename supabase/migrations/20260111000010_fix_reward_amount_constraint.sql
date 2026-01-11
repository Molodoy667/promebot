-- Fix reward_amount constraint to allow up to 100 instead of 10
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_reward_amount_check;

ALTER TABLE tasks 
  ADD CONSTRAINT tasks_reward_amount_check 
  CHECK (reward_amount >= 1 AND reward_amount <= 100);
