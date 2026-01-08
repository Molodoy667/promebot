-- Function to add budget from main balance
CREATE OR REPLACE FUNCTION add_task_budget_from_main(task_id_param UUID, amount NUMERIC)
RETURNS void AS $$
DECLARE
  task_owner UUID;
  user_main_balance NUMERIC;
BEGIN
  -- Get task owner
  SELECT user_id INTO task_owner FROM tasks WHERE id = task_id_param;
  
  IF task_owner IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Get user's main balance
  SELECT balance INTO user_main_balance FROM profiles WHERE id = task_owner;
  
  IF user_main_balance < amount THEN
    RAISE EXCEPTION 'Insufficient main balance';
  END IF;

  -- Deduct from main balance
  UPDATE profiles SET balance = balance - amount WHERE id = task_owner;
  
  -- Add to task budget
  UPDATE tasks SET budget = budget + amount WHERE id = task_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to withdraw budget to main balance
CREATE OR REPLACE FUNCTION withdraw_task_budget_to_main(task_id_param UUID, amount NUMERIC)
RETURNS void AS $$
DECLARE
  task_owner UUID;
  task_budget NUMERIC;
BEGIN
  -- Get task details
  SELECT user_id, budget INTO task_owner, task_budget FROM tasks WHERE id = task_id_param;
  
  IF task_owner IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF task_budget < amount THEN
    RAISE EXCEPTION 'Insufficient task budget';
  END IF;

  -- Deduct from task budget
  UPDATE tasks SET budget = budget - amount WHERE id = task_id_param;
  
  -- Add to main balance
  UPDATE profiles SET balance = balance + amount WHERE id = task_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
